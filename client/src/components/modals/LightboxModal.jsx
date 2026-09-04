import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

export default function LightboxModal({ imageObj, onClose }) {
  if (!imageObj) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-4 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <a
          href={imageObj.url}
          download={imageObj.title || 'downloaded-image'}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          title="Download Original Image"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          title="Close Lightbox"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image Display Container */}
      <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
        <img
          src={imageObj.url}
          alt={imageObj.title || 'Lightbox image view'}
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
        />
        {imageObj.title && (
          <p className="mt-3 text-sm text-slate-300 font-medium text-center">
            {imageObj.title}
          </p>
        )}
      </div>
    </div>
  );
}
