import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import Modal from './Modal';

type ImportTarget = 'employees' | 'compliance' | 'licenses' | 'it-access' | 'hardware';

interface Props {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

const TARGET_CONFIG: Record<ImportTarget, { table: string; label: string; requiredFields: string[]; optionalFields: string[] }> = {
  employees: {
    table: 'hq_employees',
    label: 'Employees',
    requiredFields: ['first_name', 'last_name'],
    optionalFields: ['email', 'phone', 'department', 'role', 'status', 'hire_date', 'bg_check_status', 'bg_check_expiry', 'cannabis_permit_number', 'cannabis_permit_state', 'drug_test_status', 'drug_test_last', 'drug_test_next', 'medical_card_expiry', 'emergency_name', 'emergency_phone', 'emergency_relation', 'pay_rate', 'pay_type'],
  },
  compliance: {
    table: 'hq_compliance_items',
    label: 'Compliance Items',
    requiredFields: ['title', 'category'],
    optionalFields: ['description', 'status', 'state', 'due_date', 'responsible_party', 'recurrence', 'recurrence_interval', 'regulation_ref', 'score_weight'],
  },
  licenses: {
    table: 'hq_licenses',
    label: 'Licenses',
    requiredFields: ['license_type', 'state'],
    optionalFields: ['license_number', 'license_category', 'status', 'issued_date', 'expiration_date', 'renewal_date', 'issuing_authority', 'notes', 'application_fee', 'annual_fee', 'renewal_fee', 'contact_name', 'contact_email', 'contact_phone'],
  },
  'it-access': {
    table: 'hq_employee_access',
    label: 'System Access',
    requiredFields: ['employee_email', 'system_name'],
    optionalFields: ['system_category', 'account_username', 'access_level', 'status', 'granted_date', 'notes'],
  },
  hardware: {
    table: 'hq_employee_hardware',
    label: 'Hardware',
    requiredFields: ['employee_email', 'device_type'],
    optionalFields: ['model_description', 'serial_number', 'status', 'assigned_date', 'notes'],
  },
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      if (values[i] && values[i] !== '') row[h] = values[i];
    });
    return row;
  }).filter(row => Object.keys(row).length > 0);
}

function parseTSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

  return lines.slice(1).map(line => {
    const values = line.split('\t').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      if (values[i] && values[i] !== '') row[h] = values[i];
    });
    return row;
  }).filter(row => Object.keys(row).length > 0);
}

export default function BulkImport({ open, onClose, onImportComplete }: Props) {
  const [target, setTarget] = useState<ImportTarget>('employees');
  const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'done'>('select');
  const [rawData, setRawData] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const config = TARGET_CONFIG[target];

  const handleReset = () => {
    setStep('select');
    setRawData('');
    setParsedRows([]);
    setErrors([]);
    setImportedCount(0);
    setFailedCount(0);
  };

  const handleParse = useCallback(() => {
    if (!rawData.trim()) {
      toast.error('No data to parse');
      return;
    }

    // Detect format (TSV if tabs found, otherwise CSV)
    const rows = rawData.includes('\t') ? parseTSV(rawData) : parseCSV(rawData);

    if (rows.length === 0) {
      toast.error('No valid rows found. Make sure the first row has column headers.');
      return;
    }

    // Validate required fields
    const errs: string[] = [];
    rows.forEach((row, i) => {
      config.requiredFields.forEach(field => {
        if (!row[field]) {
          errs.push(`Row ${i + 1}: missing required field "${field}"`);
        }
      });
    });

    setParsedRows(rows);
    setErrors(errs);
    setStep('preview');
  }, [rawData, config]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawData(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep('importing');
    let imported = 0;
    let failed = 0;

    // For IT access and hardware, we need to resolve employee_email to employee_id
    let employeeMap: Record<string, string> = {};
    if (target === 'it-access' || target === 'hardware') {
      const { data: employees } = await supabase.from('hq_employees').select('id, email');
      if (employees) {
        employees.forEach((e: { id: string; email: string | null }) => {
          if (e.email) employeeMap[e.email.toLowerCase()] = e.id;
        });
      }
    }

    for (const row of parsedRows) {
      try {
        const record: Record<string, unknown> = {};

        // Map fields based on target
        if (target === 'it-access' || target === 'hardware') {
          // Resolve employee email to ID
          const email = row.employee_email?.toLowerCase();
          if (!email || !employeeMap[email]) {
            failed++;
            continue;
          }
          record.employee_id = employeeMap[email];
          delete row.employee_email;
        }

        // Copy all matching fields
        const allFields = [...config.requiredFields, ...config.optionalFields];
        allFields.forEach(field => {
          if (field === 'employee_email') return; // Already handled
          if (row[field] !== undefined) {
            // Handle numeric fields
            if (['score_weight', 'recurrence_interval', 'pay_rate', 'application_fee', 'annual_fee', 'renewal_fee'].includes(field)) {
              record[field] = parseFloat(row[field]) || null;
            } else {
              record[field] = row[field];
            }
          }
        });

        // Set defaults
        if (target === 'employees' && !record.status) record.status = 'Active';
        if (target === 'compliance' && !record.status) record.status = 'Pending';
        if (target === 'licenses' && !record.status) record.status = 'Active';
        if (target === 'it-access' && !record.status) record.status = 'Active';
        if (target === 'hardware' && !record.status) record.status = 'Assigned';

        const { error } = await supabase.from(config.table).insert(record);
        if (error) {
          console.error('Import error:', error);
          failed++;
        } else {
          imported++;
        }
      } catch {
        failed++;
      }
    }

    setImportedCount(imported);
    setFailedCount(failed);
    setStep('done');

    if (imported > 0) {
      toast.success(`Imported ${imported} ${config.label.toLowerCase()}`);
      onImportComplete();
    }
  };

  return (
    <Modal open={open} onClose={() => { handleReset(); onClose(); }} title="Bulk Import" wide>
      {/* Step 1: Select target and paste data */}
      {step === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row">
            <label className="field-label">Import Type</label>
            <select className="input-field" value={target} onChange={e => setTarget(e.target.value as ImportTarget)}>
              {Object.entries(TARGET_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)' }}>
            <strong>Required columns:</strong> {config.requiredFields.join(', ')}
            <br />
            <strong>Optional columns:</strong> {config.optionalFields.slice(0, 8).join(', ')}{config.optionalFields.length > 8 ? '...' : ''}
            {(target === 'it-access' || target === 'hardware') && (
              <>
                <br />
                <strong style={{ color: 'var(--color-warning)' }}>Note:</strong> Use <code>employee_email</code> to match employees. The email must match an existing employee.
              </>
            )}
          </div>

          <div className="form-row">
            <label className="field-label">Paste CSV/TSV Data</label>
            <textarea
              className="input-field"
              rows={10}
              value={rawData}
              onChange={e => setRawData(e.target.value)}
              placeholder={`Paste data with headers in the first row. Example:\n${config.requiredFields.join(',')},${config.optionalFields.slice(0, 2).join(',')}\nvalue1,value2,value3,value4`}
              style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>Or upload a file:</span>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet size={14} /> Choose CSV/TSV File
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--color-divider)', paddingTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => { handleReset(); onClose(); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleParse} disabled={!rawData.trim()}>
              <ArrowRight size={14} /> Preview Import
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={16} />
            <strong>{parsedRows.length} rows</strong> ready to import as <strong>{config.label}</strong>
          </div>

          {errors.length > 0 && (
            <div style={{ padding: '0.75rem', background: 'var(--color-error-hl)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600, color: 'var(--color-error)', marginBottom: '0.375rem' }}>
                <AlertTriangle size={14} /> {errors.length} validation warning{errors.length !== 1 ? 's' : ''}
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {errors.slice(0, 10).map((err, i) => (
                  <div key={i} style={{ color: 'var(--color-error)' }}>{err}</div>
                ))}
                {errors.length > 10 && <div style={{ color: 'var(--color-tx-muted)' }}>...and {errors.length - 10} more</div>}
              </div>
            </div>
          )}

          {/* Data preview table */}
          <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }}>
            <table className="data-table" style={{ fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  {Object.keys(parsedRows[0] || {}).map(key => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 20 && (
              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>
                Showing first 20 of {parsedRows.length} rows
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--color-divider)', paddingTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={handleReset}>Back</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={errors.length > 0 && parsedRows.length === 0}>
              <Upload size={14} /> Import {parsedRows.length} Records
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: 32, height: 32, border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontWeight: 600 }}>Importing {parsedRows.length} records...</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', marginTop: '0.5rem' }}>This may take a moment</div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <CheckCircle size={48} style={{ color: 'var(--color-success)', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Import Complete</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-tx-muted)', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{importedCount} imported</span>
            {failedCount > 0 && (
              <span style={{ color: 'var(--color-error)', fontWeight: 600, marginLeft: '1rem' }}>{failedCount} failed</span>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => { handleReset(); onClose(); }}>Done</button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  );
}
