import { useState, useRef } from 'react';
import { Camera, SwitchCamera, Utensils, Pill } from 'lucide-react';
import { useHealthStore } from '../stores/healthStore';

type ScanType = 'food' | 'medicine';

export default function ScannerPage() {
  const { activeMemberId, familyMembers, restrictions } = useHealthStore();
  const member = familyMembers.find(m => m.id === activeMemberId);
  const [scanType, setScanType] = useState<ScanType>('food');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResultData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!capturedImage || !activeMemberId) return;
    setAnalyzing(true);
    // TODO: Send to health-ai Edge Function for analysis
    // For now, show placeholder
    setTimeout(() => {
      setResult({
        item_name: 'Sample Item',
        overall_result: 'safe',
        ingredients: ['Sample ingredient 1', 'Sample ingredient 2'],
        flagged: [],
        explanation: 'AI analysis will be connected in Phase 5. Upload an image and the AI will identify the item and check it against your restrictions.',
      });
      setAnalyzing(false);
    }, 1500);
  };

  const resetScan = () => {
    setCapturedImage(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Scanner</h1>
          <p className="view-subtitle">
            {member ? `Check food & medicine safety for ${member.first_name}` : 'Select a family member'}
          </p>
        </div>
      </div>

      <div className="scanner-type-toggle">
        <button className={`btn ${scanType === 'food' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScanType('food')}>
          <Utensils size={14} /> Food
        </button>
        <button className={`btn ${scanType === 'medicine' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScanType('medicine')}>
          <Pill size={14} /> Medicine
        </button>
      </div>

      {!capturedImage ? (
        <div className="scanner-capture-zone" onClick={() => fileInputRef.current?.click()}>
          <Camera size={48} />
          <p>Tap to take a photo of {scanType === 'food' ? 'food or its label' : 'medicine or its label'}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="scanner-preview">
          <img src={capturedImage} alt="Captured" className="scanner-preview-img" />
          <div className="scanner-preview-actions">
            <button className="btn btn-secondary" onClick={resetScan}>
              <SwitchCamera size={14} /> Retake
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={analyzing || !activeMemberId}
            >
              {analyzing ? 'Analyzing...' : `Check for ${member?.first_name ?? 'member'}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`scan-result scan-result-${result.overall_result}`}>
          <div className="scan-result-header">
            <h2>{result.overall_result.toUpperCase()}</h2>
            <p>{result.item_name}</p>
          </div>
          <div className="scan-result-body">
            {result.ingredients.length > 0 && (
              <div>
                <h4>Ingredients</h4>
                <div className="restriction-chips">
                  {result.ingredients.map((ing, i) => {
                    const isFlagged = result.flagged.some(f => f.ingredient === ing);
                    return (
                      <span key={i} className={`badge ${isFlagged ? 'badge-error' : 'badge-muted'}`}>
                        {ing}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {result.flagged.length > 0 && (
              <div>
                <h4>Flagged</h4>
                {result.flagged.map((f, i) => (
                  <div key={i} className="flagged-item">
                    <strong>{f.ingredient}</strong> — {f.reason}
                    <span className={`badge badge-${f.severity === 'critical' ? 'error' : 'warning'}`}>{f.severity}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="scan-result-explanation">{result.explanation}</p>
          </div>
        </div>
      )}

      {restrictions.length > 0 && (
        <div className="section" style={{ marginTop: '2rem' }}>
          <h3 className="section-title">Checking Against ({restrictions.filter(r => r.confirmed).length} restrictions)</h3>
          <div className="restriction-chips">
            {restrictions.filter(r => r.confirmed).map(r => (
              <span key={r.id} className={`badge badge-${r.severity === 'critical' ? 'error' : r.severity === 'warning' ? 'warning' : 'muted'}`}>
                {r.item_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScanResultData {
  item_name: string;
  overall_result: 'safe' | 'unsafe' | 'caution';
  ingredients: string[];
  flagged: Array<{ ingredient: string; severity: string; reason: string }>;
  explanation: string;
}
