import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { extractFirstUrl } from '../../utils/urlDetector.jsx';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🚀', '😍', '👏', '🙏', '👀'];

export default function MessageComposer({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  replyTarget,
  onCancelReply,
  userToken,
  connectionId
}) {
  const [text, setText] = useState('');
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleInputChange = (e) => {
    setText(e.target.value);
    onTypingStart();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
    }, 2000);
  };

  const handleSend = async () => {
    if (!text.trim() && !uploading) return;
    onTypingStop();

    const messageContent = text.trim();
    setText('');
    setShowEmojiMenu(false);

    const detectedUrl = extractFirstUrl(messageContent);
    let metadata = null;

    if (detectedUrl) {
      try {
        const res = await fetch('/api/url-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-connection-id': connectionId,
            'x-user-token': userToken
          },
          body: JSON.stringify({ url: detectedUrl })
        });
        if (res.ok) {
          metadata = await res.json();
        }
      } catch (e) {
        console.warn('URL metadata fetch error:', e);
      }
    }

    onSendMessage({
      type: metadata ? 'link' : 'text',
      content: messageContent,
      metadata,
      replyToId: replyTarget?.id || null
    });

    if (replyTarget) onCancelReply();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadSelectedFile(file);
  };

  const uploadSelectedFile = async (file) => {
    setUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('x-connection-id', connectionId);
      xhr.setRequestHeader('x-user-token', userToken);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setUploading(false);
        setUploadProgress(0);
        if (xhr.status === 200) {
          const fileData = JSON.parse(xhr.responseText);
          onSendMessage({
            type: fileData.type,
            content: `Shared ${fileData.type === 'image' ? 'an image' : 'a file'}: ${fileData.original_name}`,
            metadata: fileData,
            replyToId: replyTarget?.id || null
          });
          if (replyTarget) onCancelReply();
        } else {
          alert('File upload failed: ' + xhr.statusText);
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        alert('File upload error');
      };

      xhr.send(formData);
    } catch (err) {
      setUploading(false);
      alert('Upload error');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 relative z-10 shrink-0 transition-colors"
    >
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-600/90 text-white flex flex-col items-center justify-center gap-2 z-30 rounded-t-xl animate-fade-in backdrop-blur">
          <UploadCloud className="w-10 h-10 animate-bounce" />
          <p className="font-bold text-base">Drop file to share in space</p>
        </div>
      )}

      {replyTarget && (
        <div className="mb-2 p-2 rounded-xl bg-gray-100 dark:bg-slate-800 border-l-4 border-indigo-500 flex items-center justify-between text-xs text-gray-700 dark:text-slate-300 animate-fade-in">
          <div className="truncate">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Replying to {replyTarget.sender_name}:
            </span>{' '}
            <span className="italic">{replyTarget.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploading && (
        <div className="mb-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 animate-fade-in">
          <div className="flex justify-between font-semibold mb-1">
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Attach File or Image"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowEmojiMenu(!showEmojiMenu)}
            className="p-2.5 text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Insert Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showEmojiMenu && (
            <div className="absolute bottom-full mb-2 left-0 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl flex gap-1 z-30 animate-fade-in">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setText((prev) => prev + emoji);
                    setShowEmojiMenu(false);
                  }}
                  className="p-1.5 hover:scale-125 transition text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-2xl px-4 py-2 border border-transparent focus-within:border-indigo-500 transition">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or paste a URL..."
            className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none resize-none max-h-32"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() && !uploading}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition duration-150 shrink-0"
          title="Send Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
