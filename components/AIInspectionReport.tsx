/**
 * AI Inspection Report Display Component
 * Shows the AI-generated vehicle inspection report with grades, findings, and recommendations
 */

import React, { useState } from 'react';
import type { AIInspectionReport, AIInspectionGrade, AIInspectionFinding } from '../types';
import { getGradeColor, getGradeLabel } from '../services/aiInspectionService';

interface AIInspectionReportProps {
  report: AIInspectionReport;
  compact?: boolean;
  onRequestPhysicalInspection?: () => void;
}

const GradeBadge: React.FC<{ grade: AIInspectionGrade; size?: 'sm' | 'md' | 'lg' }> = ({ 
  grade, 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-2xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-lg`}
      style={{ backgroundColor: getGradeColor(grade) }}
      title={getGradeLabel(grade)}
    >
      {grade}
    </div>
  );
};

const ScoreBar: React.FC<{ score: number; label: string; grade: AIInspectionGrade }> = ({
  score,
  label,
  grade,
}) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: getGradeColor(grade) }}>
          {score}/100
        </span>
        <GradeBadge grade={grade} size="sm" />
      </div>
    </div>
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${score}%`, backgroundColor: getGradeColor(grade) }}
      />
    </div>
  </div>
);

const FindingItem: React.FC<{ finding: AIInspectionFinding }> = ({ finding }) => {
  const severityColors = {
    minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    major: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const severityIcons = {
    minor: '⚡',
    moderate: '⚠️',
    major: '🚨',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <span className="text-lg">{severityIcons[finding.severity]}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900 dark:text-white capitalize">
            {finding.type.replace('_', ' ')}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${severityColors[finding.severity]}`}>
            {finding.severity}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{finding.description}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Location: {finding.location} • Image {finding.imageIndex + 1}
        </p>
      </div>
    </div>
  );
};

const SectionCard: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

export const AIInspectionReportDisplay: React.FC<AIInspectionReportProps> = ({
  report,
  compact = false,
  onRequestPhysicalInspection,
}) => {
  const {
    overallGrade,
    overallScore,
    confidenceScore,
    exterior,
    interior,
    tyres,
    photoQuality,
    highlights,
    concerns,
    buyerAdvisory,
    conditionImpact,
    allFindings,
  } = report;

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GradeBadge grade={overallGrade} size="md" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                AI Inspection Grade: {overallGrade}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getGradeLabel(overallGrade)} Condition • Score: {overallScore}/100
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Confidence: {confidenceScore}%</p>
            {conditionImpact.majorIssuesCount > 0 && (
              <p className="text-xs text-red-600">{conditionImpact.majorIssuesCount} major issues</p>
            )}
          </div>
        </div>
        
        {concerns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Key concerns:</span> {concerns.slice(0, 2).join(' • ')}
            </p>
          </div>
        )}
      </div>
    );
  }

  const isDemoReport = report.modelVersion === 'demo-1.0' || report.modelVersion === 'fallback';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Demo Report Warning Banner */}
      {isDemoReport && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
          <span className="text-amber-600 dark:text-amber-400 text-lg flex-shrink-0">⚠️</span>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">This report is generated by AI based on uploaded photos. For a comprehensive evaluation, we recommend a physical inspection by a certified mechanic.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-reride-orange to-orange-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GradeBadge grade={overallGrade} size="lg" />
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                AI Inspection Report
              </h2>
              <p className="text-white/80">
                {getGradeLabel(overallGrade)} Condition • Overall Score: {overallScore}/100
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-white/80">
            <p>Confidence: {confidenceScore}%</p>
            <p>Report ID: {report.reportId}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreBar score={exterior.score} label="Exterior" grade={exterior.grade} />
          <ScoreBar score={interior.score} label="Interior" grade={interior.grade} />
          <ScoreBar score={tyres.score} label="Tyres" grade={tyres.grade} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{conditionImpact.majorIssuesCount}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Major Issues</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{conditionImpact.moderateIssuesCount}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Moderate Issues</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{conditionImpact.minorIssuesCount}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Minor Issues</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{photoQuality.overallScore}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Photo Quality</p>
          </div>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <SectionCard title="Highlights" icon="✅" defaultOpen={true}>
            <ul className="space-y-2">
              {highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-green-700 dark:text-green-400">
                  <span className="text-green-500">•</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Concerns */}
        {concerns.length > 0 && (
          <SectionCard title="Concerns" icon="⚠️" defaultOpen={true}>
            <ul className="space-y-2">
              {concerns.map((concern, idx) => (
                <li key={idx} className="flex items-start gap-2 text-orange-700 dark:text-orange-400">
                  <span className="text-orange-500">•</span>
                  {concern}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Detailed Findings */}
        {allFindings.length > 0 && (
          <SectionCard title={`All Findings (${allFindings.length})`} icon="🔍" defaultOpen={false}>
            <div className="space-y-3">
              {allFindings.map((finding, idx) => (
                <FindingItem key={idx} finding={finding} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Exterior Details */}
        <SectionCard title="Exterior Analysis" icon="🚗" defaultOpen={false}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Paint Condition</p>
                <p className="font-medium capitalize">{exterior.paintCondition}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Body Condition</p>
                <p className="font-medium capitalize">{exterior.bodyCondition}</p>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{exterior.summary}</p>
          </div>
        </SectionCard>

        {/* Interior Details */}
        <SectionCard title="Interior Analysis" icon="🪑" defaultOpen={false}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Seats</p>
                <p className="font-medium capitalize">{interior.seatCondition}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Dashboard</p>
                <p className="font-medium capitalize">{interior.dashboardCondition}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cleanliness</p>
                <p className="font-medium capitalize">{interior.cleanlinessLevel.replace('_', ' ')}</p>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{interior.summary}</p>
          </div>
        </SectionCard>

        {/* Tyre Details */}
        <SectionCard title="Tyre Analysis" icon="⚫" defaultOpen={false}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Estimated Tread</p>
                <p className="font-medium capitalize">{tyres.estimatedTreadDepth.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mismatched Tyres</p>
                <p className="font-medium">{tyres.mismatchedTyres ? 'Yes ⚠️' : 'No ✓'}</p>
              </div>
            </div>
            {tyres.brandVisible && (
              <p className="text-sm text-gray-600">Brand detected: {tyres.brandVisible}</p>
            )}
            <p className="text-gray-700 dark:text-gray-300">{tyres.summary}</p>
          </div>
        </SectionCard>

        {/* Photo Quality */}
        {photoQuality.missingViews.length > 0 && (
          <SectionCard title="Photo Quality & Recommendations" icon="📸" defaultOpen={false}>
            <div className="space-y-4">
              {photoQuality.missingViews.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Missing Views:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {photoQuality.missingViews.map((view, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-sm capitalize"
                      >
                        {view.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {photoQuality.recommendations.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recommendations:
                  </p>
                  <ul className="space-y-1">
                    {photoQuality.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Buyer Advisory */}
        {buyerAdvisory.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
              <span>💡</span> Buyer Advisory
            </h3>
            <ul className="space-y-1">
              {buyerAdvisory.map((advice, idx) => (
                <li key={idx} className="text-sm text-blue-800 dark:text-blue-300">
                  • {advice}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA for Physical Inspection */}
        {onRequestPhysicalInspection && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 rounded-lg p-6 text-center">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Want a Certified Physical Inspection?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get a 150+ point inspection by a local mechanic. Pay them directly — we connect you with leads.
            </p>
            <button
              onClick={onRequestPhysicalInspection}
              className="px-6 py-2 bg-reride-orange text-white font-semibold rounded-lg hover:bg-reride-orange/90 transition-colors"
            >
              Find a pre-purchase inspector
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p>AI inspection is based on photo analysis and may not detect all issues.</p>
          <p>Always inspect the vehicle in person before purchase.</p>
          <p className="mt-1">
            Generated: {new Date(report.generatedAt).toLocaleString()} • 
            Processing time: {report.processingTimeMs}ms
          </p>
        </div>
      </div>
    </div>
  );
};

// Compact badge for vehicle cards
export const AIInspectionBadge: React.FC<{ 
  grade: AIInspectionGrade; 
  score?: number;
  onClick?: () => void;
}> = ({ grade, score, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold text-white transition-transform hover:scale-105"
    style={{ backgroundColor: getGradeColor(grade) }}
    title={`AI Inspection Grade: ${grade} - ${getGradeLabel(grade)}${score ? ` (${score}/100)` : ''}`}
  >
    <span className="text-sm">🤖</span>
    <span>AI: {grade}</span>
    {score && <span className="opacity-80">({score})</span>}
  </button>
);

export default AIInspectionReportDisplay;
