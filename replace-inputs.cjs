const fs = require('fs');
let code = fs.readFileSync('src/components/LibroScreen.tsx', 'utf8');

const decimalInputCode = `
// A wrapper around Input to handle both dot and comma for decimal numbers
const DecimalInput = ({ value, onChange, id, disabled, placeholder, className, onFocus, onBlur, lang, step }: any) => {
  const [localValue, setLocalValue] = React.useState(value !== undefined && value !== null && value !== 0 ? String(value) : '');

  React.useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setLocalValue('');
    } else {
      const currentParsed = parseFloat(localValue.replace(',', '.'));
      if (isNaN(currentParsed) || currentParsed !== value) {
        setLocalValue(String(value));
      }
    }
  }, [value]);

  const handleChange = (e: any) => {
    let val = e.target.value;
    val = val.replace(/,/g, '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    setLocalValue(val);
    
    if (val === '' || val === '.') {
      onChange({ target: { value: '' } });
    } else {
      onChange({ target: { value: val } });
    }
  };

  return (
    <Input 
      id={id}
      type="text" 
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={localValue}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      lang={lang}
      step={step}
    />
  );
};
`;

if (!code.includes('const DecimalInput')) {
  code = code.replace('export const LibroScreen =', decimalInputCode + '\nexport const LibroScreen =');
}

const idsToReplace = [
  'airfield_day_pilot', 'airfield_day_copilot', 'airfield_night_pilot', 'airfield_night_copilot',
  'cross_country_day_pilot', 'cross_country_day_copilot', 'cross_country_night_pilot', 'cross_country_night_copilot',
  'instruction_time', 'multi_engine', 'jet', 'turboprop', 'ag_application',
  'sim_instructor', 'sim_student', 'ifr_real_pilot', 'ifr_real_copilot', 'ifr_hood'
];

for (const id of idsToReplace) {
  const regex = new RegExp(`<Input([^>]*id="${id}"?[^>]*)>`, 'g');
  code = code.replace(regex, '<DecimalInput$1>');
}

fs.writeFileSync('src/components/LibroScreen.tsx', code);
console.log('Done');
