import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Löschen',
  cancelText = 'Abbrechen',
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white border border-[#AAAAAA] rounded-sm max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#F0F4FA] border-b border-[#D8E2F0] px-4 py-2.5 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-800">{title}</h3>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-700 text-sm font-bold px-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-sm text-gray-700 leading-normal">
          {message}
        </div>

        {/* Footer */}
        <div className="bg-[#F9F9F9] border-t border-[#E5E5E5] px-4 py-2.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs font-bold text-gray-700 bg-white border border-[#CCCCCC] hover:bg-gray-50 rounded-sm cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1 text-xs font-bold text-white rounded-sm cursor-pointer ${
              isDestructive 
                ? 'bg-[#E53E3E] hover:bg-[#C53030] border border-[#C53030]' 
                : 'bg-del-blue hover:bg-del-dark-blue border border-del-dark-blue'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
