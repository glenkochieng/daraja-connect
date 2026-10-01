import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { selectedTaxonomy } from '../test/helpers.jsx';
import { TopicPicker } from './TopicPicker.jsx';

function Harness({ initial = [], max }) {
  const [value, setValue] = useState(initial);
  return (
    <TopicPicker
      label="Skills"
      topics={selectedTaxonomy.topics}
      taxonomy={selectedTaxonomy}
      value={value}
      onChange={setValue}
      max={max}
    />
  );
}

describe('TopicPicker', () => {
  it('groups topics under specialisation names, or readable domain names', () => {
    render(<Harness />);
    expect(screen.getByText('Ground Handling & Airport Services')).toBeTruthy();
    expect(screen.getByText('Career development')).toBeTruthy();
  });

  it('adds a topic, lists it as chosen, and removes it again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Skills' });
    await user.click(within(group).getByRole('button', { name: 'Station management' }));
    expect(
      within(group)
        .getByRole('button', { name: 'Station management' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(within(group).getByRole('button', { name: 'Remove Station management' }));
    expect(screen.getByText('Nothing chosen yet.')).toBeTruthy();
  });

  it('filters topics by name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText('Filter topics'), 'boeing');
    expect(screen.getByRole('button', { name: 'Boeing 737-800' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Station management' })).toBeNull();
  });

  it('stops adding at the maximum', () => {
    render(<Harness initial={['station_management']} max={1} />);
    expect(screen.getByRole('button', { name: 'Line maintenance' }).disabled).toBe(true);
    expect(screen.getByText(/maximum of 1 topics/)).toBeTruthy();
  });
});
