import * as React from 'react';


interface ColorLinkerProps {
  selected: string;
  onColorChange?: (color: string) => void;
}

// tslint:disable-next-line:variable-name
export const ColorLinker: React.FunctionComponent<ColorLinkerProps> = (props) => {
  const {selected} = props;
  const colors: string[] = ['red', 'blue', 'orange', 'purple'];
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const {value} = event.currentTarget;
    console.log('change');
  };
  return (
    <div>
      <select name="color" value={selected} onChange={handleChange}>
        {
          colors.map((color, index) => {
            return <option key={color + index} selected={selected === color} value={color}>{color}</option>;
          })
        }
      </select>
    </div>
  );
};