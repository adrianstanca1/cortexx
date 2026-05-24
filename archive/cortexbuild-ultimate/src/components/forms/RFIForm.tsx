import React, { useState } from 'react';
import { rfisApi } from '../../services/api';
import { X } from 'lucide-react';

interface RFIFormProps {
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
}

interface FormData {
  number: string;
  title: string;
  question: string;
  answer: string;
  status: string;
  dueDate: string;
  assignedToId: string;
}

interface FormErrors {
  [key: string]: string;
}

export function RFIForm({ onClose, onSuccess, projectId }: RFIFormProps) {
  const [formData, setFormData] = useState<FormData>({
    number: '',
    title: '',
    question: '',
    answer: '',
    status: 'OPEN',
    dueDate: '',
    assignedToId: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.number.trim()) {
      newErrors.number = 'RFI number is required';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await rfisApi.create({
        number: formData.number,
        title: formData.title,
        question: formData.question,
        answer: formData.answer || undefined,
        status: formData.status,
        dueDate: formData.dueDate || undefined,
        assignedToId: formData.assignedToId || undefined,
        projectId: projectId || '',
      });
      onSuccess();
      onClose();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create RFI' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showAnswerField = formData.status !== 'OPEN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-white border-b border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Create RFI</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                RFI Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                placeholder="RFI-001"
                className={`w-full px-3 py-2 rounded-lg border ${
                  errors.number ? 'border-red-500' : 'border-gray-300'
                } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.number && <p className="text-sm text-red-500 mt-1">{errors.number}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="OPEN">Open</option>
                <option value="ANSWERED">Answered</option>
                <option value="CLOSED">Closed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter RFI title"
              className={`w-full px-3 py-2 rounded-lg border ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              name="question"
              value={formData.question}
              onChange={handleChange}
              placeholder="Enter your question"
              className={`w-full h-24 px-3 py-2 rounded-lg border ${
                errors.question ? 'border-red-500' : 'border-gray-300'
              } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.question && <p className="text-sm text-red-500 mt-1">{errors.question}</p>}
          </div>

          {showAnswerField && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Answer</label>
              <textarea
                name="answer"
                value={formData.answer}
                onChange={handleChange}
                placeholder="Enter the answer"
                className="w-full h-24 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Due Date</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Assigned To</label>
              <input
                type="text"
                name="assignedToId"
                value={formData.assignedToId}
                onChange={handleChange}
                placeholder="User ID"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {errors.submit && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{errors.submit}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
