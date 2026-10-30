import { formatValue } from '../../lib/catalog';

// A record's value for expanded number styles: the number with a small unit (lb or reps), or a time.
export default function RecordValue({ value, type }) {
  if (type === 'time') return formatValue(value, type);
  return <>{value}<small>{type === 'reps' ? 'reps' : 'lb'}</small></>;
}
