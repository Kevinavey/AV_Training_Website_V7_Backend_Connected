function requireCourseSession(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.courseName !== "string" ||
    !["online", "classroom"].includes(value.deliveryType) ||
    Number.isNaN(Date.parse(value.startsAt)) ||
    Number.isNaN(Date.parse(value.endsAt)) ||
    !Number.isInteger(value.remainingSeats) ||
    !Number.isInteger(value.unitPrice?.amountMinorUnits) ||
    typeof value.unitPrice?.currency !== "string"
  ) {
    throw new Error("The course-session service returned invalid data.");
  }

  return value;
}

async function loadCourseSessions() {
  const response = await fetch(SITE_CONFIG.courseSessionsUrl, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error("Course dates are temporarily unavailable.");
  }

  const data = await response.json();
  if (!Array.isArray(data.courseSessions)) {
    throw new Error("The course-session service returned invalid data.");
  }

  return data.courseSessions.map(requireCourseSession);
}
