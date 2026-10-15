import mixpanel from 'mixpanel-browser';
import _ from 'lodash';

import type { User } from 'src/types/user';
import { getUsername } from 'src/services/user';

// Mixpanel is optional per project: with no token configured every function here is a
// no-op, so call sites never have to guard. `initAnalytics` is the only thing that
// decides whether tracking happens at all.
const _TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
const _PROJECT_NAME = import.meta.env.VITE_PROJECT_NAME;

let _enabled = false;

type EventProps = Record<string, unknown>;

// Intentions: called once from AppProvider, alongside the other site-wide init.
function initAnalytics() {
  if (!_TOKEN) {
    return;
  }
  mixpanel.init(_TOKEN, {
    // We fire page views ourselves on route change — react-router doesn't do full page
    // loads, so mixpanel's own pageview tracking would only ever see the first one.
    track_pageview: false,
    persistence: 'localStorage',
    debug: import.meta.env.DEV,
  });
  _enabled = true;
  _registerAppContext();
}

// Super properties ride along on every event from here on, including ones mixpanel fires
// itself. Lets a single mixpanel project serve several apps and still tell them apart.
// Kept separate because reset() clears persistence — see resetAnalytics below.
// Intention: this was originally used because the boilerplate's gonna be used for many projects
// and we want them to share the same mixpanel account. Remove this logic if you need to.
function _registerAppContext() {
  if (!_PROJECT_NAME) {
    return;
  }
  mixpanel.register({ $project: _PROJECT_NAME });
}

function trackEvent(name: string, props: EventProps = {}) {
  if (!_enabled) {
    return;
  }
  mixpanel.track(name, props);
}

// Ties subsequent events to this user. Safe to call repeatedly — mixpanel dedupes by id.
function identifyUser(user?: User | null) {
  if (!_enabled || !user) {
    return;
  }
  mixpanel.identify(user._id);
  mixpanel.people.set(_.pickBy({
    $name: getUsername(user),
    $email: _.get(user, 'social_data.email'),
    userType: user.user_type,
  }, value => !_.isNil(value)));
}

// On logout: drops the identity so the next user's events aren't merged into this one.
function resetAnalytics() {
  if (!_enabled) {
    return;
  }
  mixpanel.reset();
  // reset() clears persistence, super properties included — without this the `project`
  // tag would quietly disappear from every event after the first logout.
  _registerAppContext();
}

export {
  initAnalytics,
  trackEvent,
  identifyUser,
  resetAnalytics,
};
