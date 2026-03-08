import React from 'react';
import { X } from 'lucide-react';

interface QuickAnswersModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId?: string;
}

const QuickAnswersModal: React.FC<QuickAnswersModalProps> = ({ isOpen, onClose, companyId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                >
                    <X size={20} />
                </button>
                <h2 className="text-xl font-semibold mb-4">Respostas Rápidas</h2>
                <p className="text-gray-600">Funcionalidade em desenvolvimento.</p>
                {companyId && <p className="text-xs text-gray-400 mt-2">Empresa ID: {companyId}</p>}
            </div>
        </div>
    );
};

export default QuickAnswersModal;
