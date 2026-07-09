import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pressable } from '../components/primitives/Pressable';

describe('Pressable', () => {
  it('calls onPress on click', () => {
    const onPress = jest.fn();
    render(<Pressable onPress={onPress}>Open</Pressable>);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress on Enter key', () => {
    const onPress = jest.fn();
    render(<Pressable onPress={onPress}>Open</Pressable>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open' }), { key: 'Enter' });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
