import React from 'react';
import { Stethoscope } from 'lucide-react';
import { AffectedArea, AFFECTED_AREAS } from '../../types/clinical';
import { VoiceDictationButton } from '../VoiceDictationButton';

interface AreasFonoSectionProps {
  areas: AffectedArea[];
  onChange: (areas: AffectedArea[]) => void;
}

export const AreasFonoSection: React.FC<AreasFonoSectionProps> = ({
  areas,
  onChange,
}) => {
  const toggleArea = (key: string) => {
    onChange(
      areas.map(a =>
        a.area === key ? { ...a, affected: !a.affected } : a
      )
    );
  };

  const updateObservations = (key: string, observations: string) => {
    onChange(
      areas.map(a =>
        a.area === key ? { ...a, observations } : a
      )
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <h4 className="flex items-center gap-2 font-bold text-slate-700 dark:text-white mb-4">
        <Stethoscope size={18} className="text-blue-600" />
        Áreas Fonoaudiológicas
      </h4>

      <div className="space-y-3">
        {AFFECTED_AREAS.map(areaDef => {
          const areaData = (Array.isArray(areas) ? areas : []).find(a => a.area === areaDef.key);
          const isAffected = areaData?.affected || false;

          return (
            <div
              key={areaDef.key}
              className={`border rounded-xl p-4 transition-colors ${
                isAffected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => toggleArea(areaDef.key)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isAffected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-300 hover:border-blue-400'
                  }`}
                >
                  {isAffected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={`text-sm font-bold ${isAffected ? 'text-blue-700' : 'text-slate-600'}`}>
                  {areaDef.label}
                </span>
                {isAffected && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    AFECTADA
                  </span>
                )}
              </div>

              {isAffected && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Observaciones
                    </label>
                    <VoiceDictationButton
                      onTranscript={(text) =>
                        updateObservations(
                          areaDef.key,
                          areaData?.observations
                            ? areaData.observations + ' ' + text
                            : text
                        )
                      }
                    />
                  </div>
                  <textarea
                    value={areaData?.observations || ''}
                    onChange={e => updateObservations(areaDef.key, e.target.value)}
                    placeholder={`Describir aspectos relevantes de ${areaDef.label.toLowerCase()}...`}
                    rows={2}
                    className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AreasFonoSection;
