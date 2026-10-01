import { eatInputToIso, isoToEatInput } from './format.js';

/** An event as the admin form edits it: times as East Africa Time input strings. */
export function toEventForm(event) {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    startsAt: isoToEatInput(event?.startsAt),
    endsAt: isoToEatInput(event?.endsAt),
    isOnline: event?.isOnline ?? false,
    location: event?.location ?? '',
    onlineUrl: event?.onlineUrl ?? '',
    capacity: event?.capacity ?? '',
  };
}

/** The POST/PUT /api/events body. Empty times are left out so the API reports them. */
export function toEventBody(form) {
  const body = {
    title: form.title,
    description: form.description,
    isOnline: form.isOnline,
    location: form.location,
    onlineUrl: form.isOnline ? form.onlineUrl : '',
    capacity: form.capacity === '' ? null : Number(form.capacity),
  };
  if (form.startsAt) body.startsAt = eatInputToIso(form.startsAt);
  if (form.endsAt) body.endsAt = eatInputToIso(form.endsAt);
  return body;
}
