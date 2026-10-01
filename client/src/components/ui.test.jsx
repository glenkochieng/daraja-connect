import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusSign, TextField } from './ui.jsx';

describe('StatusSign', () => {
  it('always shows the status as a word, not colour alone', () => {
    render(<StatusSign status="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('flips once when the status changes', () => {
    const { container, rerender } = render(<StatusSign status="pending" />);
    const sign = () => container.querySelector('.status');
    expect(sign().dataset.flip).toBeUndefined();
    rerender(<StatusSign status="accepted" />);
    expect(sign().dataset.flip).toBe('true');
    expect(screen.getByText('Accepted')).toBeTruthy();
  });
});

describe('TextField', () => {
  it('links the label, hint and error to the input', () => {
    render(<TextField label="Email address" hint="Your work email" error="Invalid email" />);
    const input = screen.getByLabelText('Email address');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby').split(' ');
    expect(describedBy.map((id) => document.getElementById(id).textContent)).toEqual([
      'Your work email',
      'Invalid email',
    ]);
  });
});
