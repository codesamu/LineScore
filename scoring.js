function calculateScore({ scores = [], overallScores = [], formula = 'sum', overallJudgeEnabled = false }) {
  const normalScores = scores.map(Number).filter(Number.isFinite);
  let total = 0;

  switch (formula) {
    case 'average':
      if (normalScores.length) total = Math.round(normalScores.reduce((sum, score) => sum + score, 0) / normalScores.length);
      break;
    case 'drop-lowest':
      if (normalScores.length) {
        const values = [...normalScores];
        if (values.length > 1) values.sort((a, b) => a - b).shift();
        total = values.reduce((sum, score) => sum + score, 0);
      }
      break;
    case 'drop-highest':
      if (normalScores.length) {
        const values = [...normalScores];
        if (values.length > 1) values.sort((a, b) => a - b).pop();
        total = values.reduce((sum, score) => sum + score, 0);
      }
      break;
    case 'sum':
    default:
      total = normalScores.reduce((sum, score) => sum + score, 0);
      break;
  }

  const validOverallScores = overallScores
    .filter(score => score !== null && score !== undefined && score !== '')
    .map(Number)
    .filter(Number.isFinite);
  const overallScore = overallJudgeEnabled && validOverallScores.length
    ? Math.round(validOverallScores.reduce((sum, score) => sum + score, 0) / validOverallScores.length * 100) / 100
    : null;

  return { total: total + (overallScore ?? 0), overallScore };
}

module.exports = { calculateScore };
