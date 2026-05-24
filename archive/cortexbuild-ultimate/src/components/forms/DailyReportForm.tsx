import React, { useState } from 'react';
import { X } from 'lucide-react';
import { API_BASE } from '../../lib/auth-storage';

interface DailyReportFormProps {
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
}

interface FormData {
  date: string;
  weather: string;
  temperature: string;
  workforceCount: string;
  workPerformed: string;
  notes: string;
}

interface FormErrors {
  [key: string]: string;
}

export function DailyReportForm({ onClose, onSuccess, projectId }: DailyReportFormProps) {
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    weather: '',
    temperature: '',
    workforceCount: '',
    workPerformed: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.date.trim()) {
      newErrors.date = 'Date is required';
    }

    if (!formData.workPerformed.trim()) {
      newErrors.workPerformed = 'Work performed is required';
    }

    if (formData.workforceCount && isNaN(Number(formData.workforceCount))) {
      newErrors.workforceCount = 'Workforce count must be a number';
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
      const response = await fetch(`${API_BASE}/daily-reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          weather: formData.weather || undefined,
          temperature: formData.temperature || undefined,
          workforceCount: formData.workforceCount ? Number(formData.workforceCount) : undefined,
          workPerformed: formData.workPerformed,
          notes: formData.notes || undefined,
          projectId: projectId || '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit daily report');
      }

      onSuccess();
      onClose();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to submit daily report' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-white border-b border-gray-200 p-6">
          <h2 className="text-lg font-display font-semibold text-gray-900">Submit Daily Report</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Weather</label>
              <select
                name="weather"
                value={formData.weather}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="SUNNY">Sunny</option>
                <option value="CLOUDY">Cloudy</option>
                <option value="RAINY">Rainy</option>
                <option value="WINDY">Windy</option>
                <option value="STORMY">Stormy</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Temperature</label>
              <input
                type="text"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                placeholder="e.g., 72°F"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Workforce Count</label>
            <input
              type="number"
              name="workforceCount"
              value={formData.workforceCount}
              onChange={handleChange}
              placeholder="0"
              min="0"
              className={`w-full px-3 py-2 rounded-lg border ${
                errors.workforceCount ? 'border-red-500' : 'border-gray-300'
              } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.workforceCount && <p className="text-sm text-red-500 mt-1">{errors.workforceCount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Work Performed <span className="text-red-500">*</span>
            </label>
            <textarea
              name="workPerformed"
              value={formData.workPerformed}
              onChange={handleChange}
              placeholder="Describe work completed today"
              className={`w-full h-32 px-3 py-2 rounded-lg border ${
                errors.workPerformed ? 'border-red-500' : 'border-gray-300'
              } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.workPerformed && <p className="text-sm text-red-500 mt-1">{errors.workPerformed}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Additional Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes or observations"
              className="w-full h-24 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
