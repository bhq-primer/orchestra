import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

type Props = {
  onSubmit: (prompt: string) => void;
};

export function SessionCreateModal({ onSubmit }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onSubmit(text.trim());
    }
  };

  return (
    <Box paddingX={1}>
      <Text color="cyan" bold>new session &gt; </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Enter prompt for Claude..."
      />
    </Box>
  );
}
