import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { InteractiveMapView } from '../components/InteractiveMapView';

export const MapPage: React.FC = () => {
  const { summary } = useAppContext();
  const stations = summary?.stations || [];

  return (
    <div className="space-y-4">
      <InteractiveMapView stations={stations} heightClass="h-[600px]" />
    </div>
  );
};
