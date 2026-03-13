import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OnboardingHome from './OnboardingHome';

const OnboardingPreview = () => {
  const { recruitId } = useParams();
  const navigate = useNavigate();

  if (!recruitId) {
    navigate('/recruiting', { replace: true });
    return null;
  }

  return <OnboardingHome previewPipelineId={recruitId} />;
};

export default OnboardingPreview;
