export function handleKronosResult(result, actions) {
  const {
    setExerciseTable,
    setCurrentScreen,
    setDietResult,
    setSupplementResult,
    setExerciseDiscoveryResult
  } = actions;

  if (result.uiAction === "send_to_exercise_table") {
    setExerciseTable(result.data);
    setCurrentScreen("workout_table");
    return;
  }

  if (result.uiAction === "open_diet_screen") {
    setCurrentScreen("diet");
    return;
  }

  if (result.uiAction === "show_diet_result") {
    setDietResult(result.data);
    setCurrentScreen("diet_result");
    return;
  }

  if (result.uiAction === "show_supplement_result") {
    setSupplementResult(result.data || result.response);
    setCurrentScreen("supplement_result");
    return;
  }

  if (result.uiAction === "discover_exercise") {
    if (typeof setExerciseDiscoveryResult === "function") {
      setExerciseDiscoveryResult(result.data || null);
    }
    setCurrentScreen("exercise_discovery");
  }
}
