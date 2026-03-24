import InsuranceTab from '../components/Insurance/InsuranceTab';

export default function InsurancePage() {
  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Insurance</h1>
          <p className="view-subtitle">Insurance policy tracking and coverage management</p>
        </div>
      </div>
      <InsuranceTab />
    </div>
  );
}
