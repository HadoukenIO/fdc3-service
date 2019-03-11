import * as React from 'react';


interface ColorLinkerProps {
  onColorChange: (color: string) => void;
}

// tslint:disable-next-line:variable-name
export const ColorLinker: React.FunctionComponent<ColorLinkerProps> = (props) => {
  const {onColorChange: onSelect} = props;
  const colors: string[] = ['red', 'blue', 'orange', 'purple'];
  const handleSelect = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    const {value} = event.currentTarget;
    onSelect(value);
  };
  return (
    <div>
      <select name="color" onSelect={handleSelect}>
        {
          colors.map((color, index) => {
            return <option key={color + index} value={color}>{color}</option>;
          })
        }
      </select>
    </div>
  );
};