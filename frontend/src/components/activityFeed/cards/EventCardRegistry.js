import CloseCard from './CloseCard';
import MilestoneCard from './MilestoneCard';
import TallySessionCard from './TallySessionCard';

const cardRegistry = {
  close: CloseCard,
  record_week: MilestoneCard,
  first_4k_week: MilestoneCard,
  '8k_week': MilestoneCard,
  tally_session: TallySessionCard,
};

export const getCardForType = (type) => cardRegistry[type] || null;
