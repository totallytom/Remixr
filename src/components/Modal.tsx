import React from 'react';

interface ModalProps {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, title, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-dark-900 rounded-lg shadow-2xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full text-dark-400 hover:text-white transition-colors"
          title="Close"
        >
          ×
        </button>
        {title && <h2 className="text-lg font-bold text-primary-500 mb-4">{title}</h2>}
        <div className="max-h-80 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal; 