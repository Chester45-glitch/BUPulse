const { google } = require("googleapis");

// ── Forms API client ──────────────────────────────────────────────
const createFormsClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.forms({ version: "v1", auth });
};

// ── Question type builders ────────────────────────────────────────
const buildQuestion = (q, index) => {
  const base = {
    title: q.question,
    required: true,
  };

  if (q.type === "RADIO" || q.type === "multiple_choice") {
    return {
      ...base,
      choiceQuestion: {
        type: "RADIO",
        options: (q.options || []).map((opt) => ({ value: opt })),
        shuffle: false,
      },
    };
  }

  if (q.type === "CHECKBOX") {
    return {
      ...base,
      choiceQuestion: {
        type: "CHECKBOX",
        options: (q.options || []).map((opt) => ({ value: opt })),
      },
    };
  }

  if (q.type === "SHORT_ANSWER" || q.type === "short_answer") {
    return {
      ...base,
      textQuestion: { paragraph: false },
    };
  }

  if (q.type === "PARAGRAPH") {
    return {
      ...base,
      textQuestion: { paragraph: true },
    };
  }

  // Default: short answer
  return { ...base, textQuestion: { paragraph: false } };
};

// ── Create a Google Form ─────────────────────────────────────────
// questions: [{ question, type, options?, correct? }]
// Returns: { formId, formUrl, editUrl }
const createForm = async (
  title,
  description,
  questions = [],
  accessToken,
  refreshToken
) => {
  const forms = createFormsClient(accessToken, refreshToken);

  // Step 1: Create the blank form
  const createRes = await forms.forms.create({
    requestBody: {
      info: {
        title,
        documentTitle: title,
      },
    },
  });

  const formId = createRes.data.formId;

  // Step 2: Build batch update requests
  const requests = [];

  // Add description as a text item if provided
  if (description) {
    requests.push({
      createItem: {
        item: {
          title: "About this quiz",
          description,
          textItem: {},
        },
        location: { index: 0 },
      },
    });
  }

  // Add each question
  questions.forEach((q, i) => {
    requests.push({
      createItem: {
        item: {
          title: q.question,
          questionItem: {
            question: buildQuestion(q, i),
          },
        },
        location: { index: description ? i + 1 : i },
      },
    });
  });

  // Step 3: Set as quiz and add all items
  requests.unshift({
    updateSettings: {
      settings: {
        quizSettings: { isQuiz: true },
      },
      updateMask: "quizSettings",
    },
  });

  if (requests.length > 0) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests },
    });
  }

  // Step 4: Set answer keys for multiple choice questions
  const answerRequests = [];
  questions.forEach((q, i) => {
    const itemIndex = description ? i + 1 : i;
    if (
      (q.type === "RADIO" || q.type === "multiple_choice") &&
      q.correct !== undefined &&
      q.options?.[q.correct]
    ) {
      answerRequests.push({
        updateItem: {
          item: {
            questionItem: {
              question: {
                grading: {
                  pointValue: q.points || 1,
                  correctAnswers: {
                    answers: [{ value: q.options[q.correct] }],
                  },
                },
              },
            },
          },
          location: { index: itemIndex },
          updateMask: "questionItem.question.grading",
        },
      });
    }
  });

  if (answerRequests.length > 0) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests: answerRequests },
    }).catch((e) => {
      // Grading update can fail if form structure changes — non-fatal
      console.warn("Answer key update warning:", e.message);
    });
  }

  // Fetch final form to get URLs
  const finalForm = await forms.forms.get({ formId });

  return {
    formId,
    formUrl:  finalForm.data.responderUri,
    editUrl:  `https://docs.google.com/forms/d/${formId}/edit`,
    title,
  };
};

module.exports = { createForm };
