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

// ── Drive client (needed to share the form file) ──────────────────
const createDriveClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
};

// ── Build the question body (no title here — title goes on item) ──
const buildQuestionBody = (q) => {
  const type = (q.type || "SHORT_ANSWER").toUpperCase().replace(" ", "_");

  if (type === "RADIO" || type === "MULTIPLE_CHOICE") {
    return {
      required: true,
      choiceQuestion: {
        type: "RADIO",
        options: (q.options || []).map((opt) => ({ value: String(opt) })),
        shuffle: false,
      },
    };
  }

  if (type === "CHECKBOX") {
    return {
      required: true,
      choiceQuestion: {
        type: "CHECKBOX",
        options: (q.options || []).map((opt) => ({ value: String(opt) })),
        shuffle: false,
      },
    };
  }

  // SHORT_ANSWER / PARAGRAPH / default
  return {
    required: true,
    textQuestion: { paragraph: type === "PARAGRAPH" },
  };
};

// ── Create a Google Form with questions ───────────────────────────
// questions: [{ question, type, options?, correct?, points? }]
// Returns:   { formId, formUrl, editUrl, title }
const createForm = async (title, description, questions = [], accessToken, refreshToken) => {
  const forms = createFormsClient(accessToken, refreshToken);

  // ── Step 1: Create the blank form ────────────────────────────
  const createRes = await forms.forms.create({
    requestBody: {
      info: { title, documentTitle: title },
    },
  });
  const formId = createRes.data.formId;

  // ── Step 2: Mark as quiz + add all items in one batchUpdate ──
  const requests = [
    // Always set quiz mode first
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings",
      },
    },
  ];

  // Optional description text item
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

  // Questions — title goes on item, question body has NO title field
  questions.forEach((q, i) => {
    requests.push({
      createItem: {
        item: {
          title: q.question,          // ← title on item, NOT inside question
          questionItem: {
            question: buildQuestionBody(q),   // ← no title here
          },
        },
        location: { index: description ? i + 1 : i },
      },
    });
  });

  await forms.forms.batchUpdate({
    formId,
    requestBody: { requests },
  });

  // ── Step 3: Set answer keys (fetch item IDs first) ────────────
  const radioQuestions = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => {
      const type = (q.type || "").toUpperCase();
      return (type === "RADIO" || type === "MULTIPLE_CHOICE") &&
        q.correct !== undefined &&
        q.options?.[q.correct];
    });

  if (radioQuestions.length > 0) {
    try {
      // Fetch the form to get real item IDs
      const formData = await forms.forms.get({ formId });
      const items = formData.data.items || [];

      const gradeRequests = radioQuestions
        .map(({ q, i }) => {
          const itemOffset = description ? i + 1 : i;
          const item = items[itemOffset];
          if (!item?.itemId) return null;
          return {
            updateItem: {
              item: {
                itemId: item.itemId,
                questionItem: {
                  question: {
                    questionId: item.questionItem?.question?.questionId,
                    grading: {
                      pointValue: q.points || 1,
                      correctAnswers: {
                        answers: [{ value: String(q.options[q.correct]) }],
                      },
                    },
                  },
                },
              },
              updateMask: "questionItem.question.grading",
            },
          };
        })
        .filter(Boolean);

      if (gradeRequests.length > 0) {
        await forms.forms.batchUpdate({
          formId,
          requestBody: { requests: gradeRequests },
        });
      }
    } catch (e) {
      // Non-fatal — quiz still works, just without auto-grading
      console.warn("Answer key warning:", e.message);
    }
  }

  // ── Step 4: Share the form via Drive so Classroom can attach it ──
  // Without this, Classroom throws @AttachmentNotVisible when trying
  // to attach the file because it can't verify visibility.
  try {
    const drive = createDriveClient(accessToken, refreshToken);
    await drive.permissions.create({
      fileId: formId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (e) {
    console.warn("Could not share form file — Classroom attachment may fail:", e.message);
  }

  // ── Step 5: Return URLs ───────────────────────────────────────
  const finalForm = await forms.forms.get({ formId });

  return {
    formId,
    formUrl: finalForm.data.responderUri,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    title,
  };
};

module.exports = { createForm };
