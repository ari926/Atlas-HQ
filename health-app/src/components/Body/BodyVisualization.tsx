import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useHealthStore, type RegionStatus } from '../../stores/healthStore';
import * as THREE from 'three';

const REGION_COLORS: Record<RegionStatus, string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  nodata: '#9ca3af',
};

interface BodyRegionProps {
  name: string;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  shape: 'sphere' | 'box' | 'capsule';
  status: RegionStatus;
  selected: boolean;
  onSelect: (name: string) => void;
}

function BodyRegion({ name, label, position, size, shape, status, selected, onSelect }: BodyRegionProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const color = REGION_COLORS[status];

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => onSelect(name)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {shape === 'sphere' && <sphereGeometry args={[size[0], 16, 16]} />}
        {shape === 'box' && <boxGeometry args={size} />}
        {shape === 'capsule' && <capsuleGeometry args={[size[0], size[1], 8, 16]} />}
        <meshStandardMaterial
          color={color}
          emissive={hovered || selected ? color : '#000000'}
          emissiveIntensity={hovered ? 0.5 : selected ? 0.3 : 0}
          transparent
          opacity={hovered ? 1 : 0.85}
          roughness={0.4}
        />
      </mesh>
      {(hovered || selected) && (
        <Text
          position={[0, size[1] / 2 + 0.3, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

const BODY_REGIONS = [
  { name: 'head', label: 'Head', position: [0, 3.8, 0] as [number, number, number], size: [0.5, 0.5, 0.5] as [number, number, number], shape: 'sphere' as const },
  { name: 'chest', label: 'Chest', position: [0, 2.2, 0] as [number, number, number], size: [1.2, 1.0, 0.6] as [number, number, number], shape: 'box' as const },
  { name: 'heart', label: 'Heart', position: [0.3, 2.4, 0.3] as [number, number, number], size: [0.25, 0.25, 0.25] as [number, number, number], shape: 'sphere' as const },
  { name: 'lungs', label: 'Lungs', position: [-0.3, 2.3, 0.15] as [number, number, number], size: [0.3, 0.4, 0.25] as [number, number, number], shape: 'sphere' as const },
  { name: 'abdomen', label: 'Abdomen', position: [0, 1.0, 0] as [number, number, number], size: [1.0, 0.8, 0.5] as [number, number, number], shape: 'box' as const },
  { name: 'liver', label: 'Liver', position: [0.35, 1.3, 0.2] as [number, number, number], size: [0.22, 0.22, 0.22] as [number, number, number], shape: 'sphere' as const },
  { name: 'stomach', label: 'Stomach', position: [-0.2, 1.1, 0.2] as [number, number, number], size: [0.2, 0.2, 0.2] as [number, number, number], shape: 'sphere' as const },
  { name: 'kidneys', label: 'Kidneys', position: [0, 0.8, -0.15] as [number, number, number], size: [0.18, 0.18, 0.18] as [number, number, number], shape: 'sphere' as const },
  { name: 'left_arm', label: 'Left Arm', position: [-1.1, 2.0, 0] as [number, number, number], size: [0.15, 1.2, 0.15] as [number, number, number], shape: 'capsule' as const },
  { name: 'right_arm', label: 'Right Arm', position: [1.1, 2.0, 0] as [number, number, number], size: [0.15, 1.2, 0.15] as [number, number, number], shape: 'capsule' as const },
  { name: 'left_leg', label: 'Left Leg', position: [-0.35, -0.8, 0] as [number, number, number], size: [0.18, 1.5, 0.18] as [number, number, number], shape: 'capsule' as const },
  { name: 'right_leg', label: 'Right Leg', position: [0.35, -0.8, 0] as [number, number, number], size: [0.18, 1.5, 0.18] as [number, number, number], shape: 'capsule' as const },
  { name: 'spine', label: 'Spine', position: [0, 1.5, -0.3] as [number, number, number], size: [0.08, 2.0, 0.08] as [number, number, number], shape: 'capsule' as const },
];

export default function BodyVisualization() {
  const { regionHealthMap, metrics } = useHealthStore();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const selectedMetrics = selectedRegion
    ? metrics.filter(m => m.body_region === selectedRegion)
    : [];

  return (
    <div className="body-view">
      <div className="body-canvas">
        <Canvas camera={{ position: [0, 1.5, 6], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-3, 3, -3]} intensity={0.3} />

          {BODY_REGIONS.map(region => (
            <BodyRegion
              key={region.name}
              {...region}
              status={regionHealthMap[region.name] ?? 'nodata'}
              selected={selectedRegion === region.name}
              onSelect={setSelectedRegion}
            />
          ))}

          <OrbitControls
            enablePan={false}
            minDistance={3}
            maxDistance={10}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.2}
          />
        </Canvas>
      </div>

      {selectedRegion && (
        <div className="body-region-panel">
          <div className="body-region-panel-header">
            <h3>{BODY_REGIONS.find(r => r.name === selectedRegion)?.label ?? selectedRegion}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRegion(null)}>Close</button>
          </div>

          <div className="body-region-status">
            <span className={`severity-dot severity-${regionHealthMap[selectedRegion] ?? 'nodata'}`} />
            <span>{(regionHealthMap[selectedRegion] ?? 'nodata').toUpperCase()}</span>
          </div>

          {selectedMetrics.length === 0 ? (
            <p style={{ color: 'var(--color-tx-muted)', fontSize: 'var(--text-sm)' }}>
              No health metrics for this region yet. Upload a medical report to populate data.
            </p>
          ) : (
            <div className="metric-list">
              {selectedMetrics.slice(0, 10).map(m => (
                <div key={m.id} className="metric-item">
                  <div className="metric-name">{m.metric_name}</div>
                  <div className="metric-value">
                    {m.metric_value} {m.metric_unit ?? ''}
                    <span className={`badge badge-${m.status === 'normal' ? 'success' : m.status === 'critical' ? 'error' : 'warning'}`}>
                      {m.status}
                    </span>
                  </div>
                  {(m.ref_range_low != null || m.ref_range_high != null) && (
                    <div className="metric-range">
                      Ref: {m.ref_range_low ?? '?'} - {m.ref_range_high ?? '?'} {m.metric_unit ?? ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="body-legend">
        {Object.entries(REGION_COLORS).map(([status, color]) => (
          <div key={status} className="body-legend-item">
            <span className="body-legend-dot" style={{ background: color }} />
            <span>{status === 'nodata' ? 'No Data' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
