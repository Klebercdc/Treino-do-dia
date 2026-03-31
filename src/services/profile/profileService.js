async function getContext(profile = {}) {
  return {
    stable: profile.stable || {},
    recent: profile.recent || {},
    insights: profile.insights || {},
  };
}

module.exports = { getContext };
