import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

type Props = {
  active: boolean;
  label: string;
  onSubmit: (text: string) => void;
};

export function InputBar({ active, label, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onSubmit(text.trim());
      setValue("");
    }
  };

  if (!active) return null;

  return (
    <Box paddingX={1}>
      <Text color="cyan" bold>{label} &gt; </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
