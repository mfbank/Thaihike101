'use client';

import React from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'confirm' | 'alert' | 'success';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'alert',
  onConfirm,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก'
}: ModalProps) {
  if (!isOpen) return null;

  const Icon = {
    confirm: HelpCircle,
    alert: AlertCircle,
    success: CheckCircle
  }[type];

  const iconColor = {
    confirm: 'text-blue-600 bg-blue-100',
    alert: 'text-red-600 bg-red-100',
    success: 'text-green-600 bg-green-100'
  }[type];

  const buttonColor = {
    confirm: 'bg-blue-600 hover:bg-blue-700',
    alert: 'bg-red-600 hover:bg-red-700',
    success: 'bg-green-600 hover:bg-green-700'
  }[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-full ${iconColor}`}>
            <Icon className="h-6 w-6" />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
        
        <div className="flex justify-end space-x-3">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${buttonColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
