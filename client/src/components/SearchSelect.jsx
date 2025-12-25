import { useId } from "react";

const SearchSelect = ({
  label,
  value,
  defaultValue,
  onChange,
  onBlur,
  options,
  placeholder,
  listId
}) => {
  const generatedId = useId();
  const resolvedListId = listId || `list-${generatedId}`;
  const inputProps = {
    type: "search",
    list: resolvedListId,
    onChange,
    onBlur,
    placeholder
  };

  if (value !== undefined) {
    inputProps.value = value;
  } else if (defaultValue !== undefined) {
    inputProps.defaultValue = defaultValue;
  }

  const inputElement = <input {...inputProps} />;
  const dataList = (
    <datalist id={resolvedListId}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  );

  if (label) {
    return (
      <label>
        {label}
        {inputElement}
        {dataList}
      </label>
    );
  }

  return (
    <>
      {inputElement}
      {dataList}
    </>
  );
};

export default SearchSelect;
