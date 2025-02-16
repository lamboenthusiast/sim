import { ContextSettings } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ContextSettingsPanelProps {
  settings: ContextSettings;
  onSettingsChange: (settings: ContextSettings) => void;
}

export function ContextSettingsPanel({ settings, onSettingsChange }: ContextSettingsPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulated API call - replace with actual save functionality
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSettingsChange(localSettings);
      // You would typically make an API call here to save the settings
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="p-2 bg-white rounded-xl border shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Context</h2>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
        <textarea
          value={localSettings.background}
          onChange={(e) => setLocalSettings({ ...localSettings, background: e.target.value })}
          className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Add background information about the person..."
          rows={4}
        />
      </div>

      <div className="p-4 bg-white rounded-xl border shadow-sm">
        <h2 className="text-lg font-semibold mb-2 text-gray-900">Conversation Style</h2>
        <select
          value={localSettings.style}
          onChange={(e) => setLocalSettings({ ...localSettings, style: e.target.value as ContextSettings['style'] })}
          className="w-full p-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="casual">Casual</option>
          <option value="professional">Professional</option>
          <option value="flirty">Flirty</option>
          <option value="friendly">Friendly</option>
        </select>
      </div>
    </div>
  );
} 