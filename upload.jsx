import React, { useRef, useState } from "react";
import { Post, Venue, User } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";
import { ArrowLeft, MapPin, Sparkles, Check, Upload as UploadIcon, Loader2, Camera as CameraIcon, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { AnimatePresence } from "framer-motion";
import CameraCapture from "../components/upload/CameraCapture";
import { useAuthModal } from "@/components/auth/AuthModalContext";

export default function Upload() {
  const { openLogin } = useAuthModal();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [vibeRating, setVibeRating] = useState(3);
  const [enhanceLighting, setEnhanceLighting] = useState(false);
  const [locationTag, setLocationTag] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadStage, setUploadStage] = useState("idle");
  const [uploadDebug, setUploadDebug] = useState(null);

  const vibeFilters = [
    { id: "sunset", name: "Sunset Glare", gradient: "from-orange-400 via-pink-500 to-purple-600" },
    { id: "neon", name: "Neon Dream", gradient: "from-blue-500 via-purple-500 to-pink-500" },
    { id: "aura", name: "Aura Glow", gradient: "from-yellow-400 via-orange-500 to-red-600" },
    { id: "retro", name: "Retro Film", gradient: "from-teal-400 via-green-500 to-blue-600" },
    { id: "mono", name: "Mono Noir", gradient: "from-gray-700 via-gray-500 to-gray-800" }
  ];

  const vibeScores = [
    { value: 1, emoji: "😐", label: "Meh", color: "from-gray-500 to-gray-600" },
    { value: 2, emoji: "🌊", label: "Chill", color: "from-blue-400 to-blue-500" },
    { value: 3, emoji: "😎", label: "Cool", color: "from-purple-400 to-purple-500" },
    { value: 4, emoji: "🔥", label: "Fire", color: "from-orange-400 to-red-500" },
    { value: 5, emoji: "🤯", label: "Insane", color: "from-pink-400 to-fuchsia-500" }
  ];

  React.useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    setAuthLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (err) {
      console.log("User not authenticated:", err);
      setCurrentUser(null);
    }
    setAuthLoading(false);
  };

  const handleLogin = async () => {
    try {
      await User.login();
      await loadCurrentUser();
    } catch (err) {
      console.error("Login failed:", err);
      toast.error("Login failed. Please try again.");
    }
  };

  const handleFileChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) {
        alert("No file received");
        return;
      }
      alert("Got file: " + file.name + " | " + file.type + " | " + file.size + " bytes");
      setUploadedFileUrl(null);
      setUploadStage("file_selected");
      setUploadDebug(null);
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    } catch (err) {
      alert("Error in handler: " + err.message);
    }
  };

  const handleCameraCapture = async (file) => {
    try {
      console.log('[Upload] camera capture received', { name: file?.name, type: file?.type, sizeBytes: file?.size });
      setUploadStage('upload_started');
      setUploadDebug({
        stage: 'upload_started',
        name: file?.name,
        type: file?.type,
        sizeMb: Number(((file?.size || 0) / (1024 * 1024)).toFixed(2))
      });
      setMediaFile(file);
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
      setShowCamera(false);

      const { file_url } = await UploadFile({ file });
      setUploadedFileUrl(file_url);
      setUploadStage('upload_success');
      setUploadDebug((prev) => ({ ...(prev || {}), stage: 'upload_success', file_url }));
    } catch (error) {
      console.error('[Upload] camera upload failed', error);
      setUploadStage('upload_failed');
      setUploadDebug((prev) => ({ ...(prev || {}), stage: 'upload_failed', error: error?.message || 'Camera upload failed. Please try again.' }));
      toast.error(error?.message || 'Camera upload failed. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error("Please log in to upload content.");
      return;
    }

    if (!mediaFile && !caption.trim()) {
      toast.error("Please add text or select a photo/video");
      return;
    }


    setUploading(true);
    const mediaType = mediaFile?.type?.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(mediaFile?.name || '') ? 'video' : 'image';

    try {
      let fileUrl = uploadedFileUrl;

      if (mediaFile && !fileUrl) {
        console.log('Uploading file:', mediaFile);
        setUploadStage('upload_started');
        const result = await UploadFile({ file: mediaFile });
        console.log('Upload response:', result);
        fileUrl = result?.file_url || null;
        setUploadedFileUrl(fileUrl);

        if (!fileUrl) {
          throw new Error('Upload did not return a file URL');
        }

        setUploadStage('upload_success');
        setUploadDebug((prev) => ({ ...(prev || {}), stage: 'upload_success', file_url: fileUrl }));
      }

      const postData = {
        content: caption,
        venue_id: selectedVenue?.id || "default_venue",
        vibe_rating: vibeRating,
        is_live: true,
        location_tag: locationTag || null,
        custom_venue_name: selectedVenue?.name || locationTag || null,
        custom_venue_address: selectedVenue?.address || null,
      };

      if (fileUrl) {
        postData.media_url = fileUrl;
        postData.media_type = mediaType;
      }

      console.log('[Upload] database save starting', postData);
      setUploadStage('database_save_started');
      await Post.create(postData);
      console.log('[Upload] database save success');
      setUploadStage('database_save_success');
      setUploadDebug((prev) => ({ ...(prev || {}), stage: 'database_save_success' }));

      toast.success("🎉 Vibe posted successfully!", {
        description: "Your vibe is now live on the feed!",
        duration: 4000,
      });

      setMediaFile(null);
      setMediaPreview(null);
      setUploadedFileUrl(null);
      setCaption("");
      setVibeRating(3);
      setLocationTag("");
      setSelectedVenue(null);
      setSelectedFilter(null);
      setEnhanceLighting(false);
      setUploadDebug(null);
      setUploadStage('idle');

      setTimeout(() => {
        window.location.href = createPageUrl("feed");
      }, 1500);

    } catch (error) {
      console.error('[Upload] upload failed', error);
      const message = String(error?.message || '').toLowerCase();
      let description = 'Please try again or check your connection';
      if (message.includes('network')) description = 'Upload failed due to network issue';
      if (message.includes('upload_timeout') || message.includes('timeout')) description = 'Upload timed out, please try again on a stronger connection';
      if (message.includes('format')) description = 'This file format is not supported';
      setUploadStage('upload_failed');
      setUploadDebug((prev) => ({ ...(prev || {}), stage: 'upload_failed', error: error?.message || 'Unknown error' }));
      toast.error('Failed to upload vibe', { description });
    }

    setUploading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0515] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0515] flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-4">Login Required</h2>
          <button 
            onClick={() => openLogin()}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-semibold shadow-[0_0_25px_rgba(236,72,153,1)]"
          >
            Login to Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showCamera && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0A0515] text-white flex flex-col pb-safe">
        {/* Header */}
        <header className="flex items-center justify-between px-4 pt-4 pb-2">
          <button 
            onClick={() => window.history.back()}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => window.history.back()}
            className="text-sm font-semibold"
          >
            Cancel
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Media Upload Area */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                name="media"
                accept="image/*,video/*,.mov,.mp4,.m4v,.webm,.heic,.heif,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                capture="environment"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none"
                }}
              />
              
              {mediaFile ? (
                <div className="relative h-64 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center px-6">
                  {mediaPreview ? (
                    mediaFile?.type?.startsWith('video/') || /\.(mp4|mov|m4v|webm|hevc)$/i.test(mediaFile?.name || '') ? (
                      <video src={mediaPreview} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={mediaPreview} alt={mediaFile?.name || 'Selected file'} className="absolute inset-0 w-full h-full object-cover" />
                    )
                  ) : mediaFile?.type?.startsWith('video/') || /\.(mp4|mov|m4v|webm|hevc)$/i.test(mediaFile?.name || '') ? (
                    <VideoIcon className="w-16 h-16 text-purple-300/70 mb-4" />
                  ) : (
                    <ImageIcon className="w-16 h-16 text-purple-300/70 mb-4" />
                  )}
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="relative z-10 text-sm font-semibold text-white break-all">{mediaFile?.name || 'Selected file'}</div>
                  <div className="relative z-10 text-xs text-purple-200/70 mt-2">
                    {uploadedFileUrl ? 'File uploaded and ready to post' : uploadStage === 'upload_started' ? 'Uploading file…' : 'File selected'}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove selected media"
                    onClick={() => {
                      setMediaFile(null);
                      setMediaPreview(null);
                      setUploadedFileUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-3xl border-2 border-dashed border-purple-400/50 bg-white/5 p-8 text-center"
                  style={{ minHeight: "280px" }}
                >
                  <div className="flex flex-col items-center justify-center h-full py-8">
                    <UploadIcon className="w-12 h-12 text-purple-300/70 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Tap or Drag Your Vibe Here</h3>
                    <p className="text-sm text-purple-200/70 mb-6">Upload a photo or video to get started.</p>
                    
                    {/* Upload Options */}
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <button
                        type="button"
                        onClick={() => {
                          console.log('[Upload] library picker requested');
                          setUploadStage('picker_requested');
                          fileInputRef.current?.click();
                        }}
                        className="px-6 py-3 rounded-full bg-purple-600/80 text-sm font-medium hover:bg-purple-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <VideoIcon className="w-4 h-4" />
                        Select from Library
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-sm font-semibold shadow-[0_0_20px_rgba(236,72,153,0.8)] hover:shadow-[0_0_30px_rgba(236,72,153,1)] transition-all flex items-center justify-center gap-2"
                      >
                        <CameraIcon className="w-4 h-4" />
                        📸 Open Live Camera
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {uploadDebug && (
              <div className={`rounded-2xl border p-4 text-left text-xs space-y-1 ${uploadStage === 'upload_failed' ? 'border-red-500/40 bg-red-950/30 text-red-100' : 'border-white/10 bg-black/30 text-purple-100'}`}>
                <div className="font-semibold text-white">Upload debug</div>
                <div>Stage: {uploadStage}</div>
                <div>Filename: {uploadDebug.name || '—'}</div>
                <div>Type: {uploadDebug.type || '—'}</div>
                <div>Size: {uploadDebug.sizeMb ? `${uploadDebug.sizeMb} MB` : '—'}</div>
                <div>File URL: {uploadDebug.file_url || '—'}</div>
                <div>Error: {uploadDebug.error || uploadDebug.reason || '—'}</div>
                <div>Preview error: {uploadDebug.previewError || '—'}</div>
              </div>
            )}

            {/* Caption */}
            <div>
              <label className="block text-sm font-medium text-purple-200/70 mb-2">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Describe the vibe..."
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-white placeholder-purple-200/50 focus:outline-none focus:border-purple-500 min-h-[120px] resize-none"
              />
            </div>

            {/* Add Vibe Score */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Add Vibe Score</h3>
              <div className="flex justify-between gap-2">
                {vibeScores.map((score) => (
                  <button
                    key={score.value}
                    type="button"
                    onClick={() => setVibeRating(score.value)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl bg-white/5 border transition-all ${
                      vibeRating === score.value
                        ? `border-transparent shadow-[0_0_20px_rgba(236,72,153,0.8)] bg-gradient-to-br ${score.color}`
                        : 'border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-3xl">{score.emoji}</span>
                    <span className={`text-[11px] font-medium ${
                      vibeRating === score.value ? 'text-white' : 'text-purple-200/70'
                    }`}>
                      {score.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Enhance Lighting */}
            <button
              type="button"
              onClick={() => setEnhanceLighting(!enhanceLighting)}
              className="flex items-center gap-3 w-full text-left"
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="flex-1">Enhance lighting for {enhanceLighting ? '✅' : '☑️'} Vibe Score!</span>
            </button>

            {/* Tag Location */}
            <button
              type="button"
              onClick={() => {
                const location = prompt("Enter location:");
                if (location) setLocationTag(location);
              }}
              className="flex items-center gap-3 px-5 py-4 rounded-full bg-white/5 border border-white/10 w-full hover:bg-white/10 transition-colors"
            >
              <MapPin className="w-5 h-5 text-purple-300" />
              <span className="text-purple-200/80">{locationTag || "Tag Location"}</span>
            </button>

            {/* Vibe Filters */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Vibe Filters</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {vibeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSelectedFilter(filter.id)}
                    className="flex-shrink-0 flex flex-col items-center gap-2"
                  >
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${filter.gradient} ${
                      selectedFilter === filter.id ? 'ring-4 ring-purple-500' : ''
                    }`} />
                    <span className="text-[11px] text-purple-200/70">{filter.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Post Button */}
            <button
              type="submit"
              disabled={uploading || (!mediaFile && !caption.trim())}
              aria-disabled={uploading || (!mediaFile && !caption.trim())}
              className="w-full py-4 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold text-lg shadow-[0_0_30px_rgba(236,72,153,0.8)] hover:shadow-[0_0_40px_rgba(236,72,153,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Posting...
                </span>
              ) : uploadStage === 'upload_started' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading media...
                </span>
              ) : (
                "Post Vibe"
              )}
            </button>

          </form>
        </div>

        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </>
  );
}
