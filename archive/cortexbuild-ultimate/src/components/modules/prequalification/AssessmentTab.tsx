import type { Subcontractor, ScoringCriteria } from './types';

interface AssessmentTabProps {
  selectedSubcontractor: Subcontractor | null;
  scoringData: Record<string, number>;
  criteria: ScoringCriteria[];
  onScoreChange: (index: string, value: number) => void;
  weightedScore: number;
  onSave: () => void;
  onCancel: () => void;
}

export function AssessmentTab({
  selectedSubcontractor,
  scoringData,
  criteria,
  onScoreChange,
  weightedScore,
  onSave,
  onCancel,
}: AssessmentTabProps) {
  if (!selectedSubcontractor) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="text-center py-12">
          <p className="text-gray-400">
            Select an application from the Applications tab to assess
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">
            {selectedSubcontractor.company}
          </h3>
          <p className="text-gray-400">Trade: {selectedSubcontractor.trade}</p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-white">Scoring Matrix</h4>
          {criteria.map((criteriaItem, index) => (
            <div key={index} className="bg-gray-700 rounded p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white font-medium">
                  {criteriaItem.name}
                </label>
                <span className="text-gray-400 text-sm">
                  Weight: {criteriaItem.weight}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={scoringData[index.toString()] || 3}
                  onChange={(e) =>
                    onScoreChange(index.toString(), parseInt(e.target.value))
                  }
                  className="flex-1"
                />
                <span className="text-amber-400 font-bold w-8 text-right">
                  {scoringData[index.toString()] || 3}/5
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <p className="text-gray-300 text-sm mb-1">Weighted Total Score</p>
          <p className="text-3xl font-bold text-amber-400">{weightedScore}%</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition"
          >
            Save Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
