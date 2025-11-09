import { useState, useEffect } from 'react';
import { Authenticator, Button, Heading, Flex, View, Card, Text, Alert, TextAreaField, TextField, SelectField } from '@aws-amplify/ui-react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import { list, remove } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';
import '@aws-amplify/ui-react/styles.css';
import { fetchAuthSession } from 'aws-amplify/auth';

const formFields = {
  signUp: {
    email: { order: 1, isRequired: true },
    password: { order: 2 },
    confirm_password: { order: 3 },
  },
};

const acceptedFileTypes = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const apiName = 'EduCloud-Summarizer-API';

function App() {
  // States
  const [quizFiles, setQuizFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [summaryFile, setSummaryFile] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [userFiles, setUserFiles] = useState([]);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState(false);

  const [activeView, setActiveView] = useState('dashboard');

  // Resume Builder State
  const [resumeData, setResumeData] = useState({
    fullName: '', email: '', phone: '', education: '', experience: '', skills: '', targetJob: ''
  });
  const [generatedResume, setGeneratedResume] = useState('');
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState('');
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);

  // Mock Interview State
  const [interviewRole, setInterviewRole] = useState('');
  const [interviewLevel, setInterviewLevel] = useState('entry');
  const [currentInterviewQuestion, setCurrentInterviewQuestion] = useState('');
  const [interviewAnswer, setInterviewAnswer] = useState('');
  const [interviewFeedback, setInterviewFeedback] = useState('');
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);

  // Skill Gap State
  const [currentSkills, setCurrentSkills] = useState('');
  const [targetJobRole, setTargetJobRole] = useState('');
  const [skillGapResult, setSkillGapResult] = useState(null);
  const [isAnalyzingSkills, setIsAnalyzingSkills] = useState(false);

  // Fetch quiz files
  async function fetchQuizFiles() {
    setIsLoadingFiles(true);
    try {
      const result = await list({ path: "quizzes/", options: { listAll: true } });
      const actualFiles = result.items.filter(item => item.size > 0 && item.path && !item.path.endsWith('/'));
      setQuizFiles(actualFiles.map(file => ({ key: file.path, lastModified: file.lastModified?.toLocaleString() || 'N/A' })));
    } catch (error) {
      console.error('Error fetching quiz files:', error);
      setQuizFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }

  // Fetch user files
  async function fetchUserFiles() {
    setIsLoadingUserFiles(true);
    try {
      const result = await list({ path: ({ identityId }) => `protected/${identityId}/myfiles/`, options: { listAll: true } });
      const actualFiles = result.items.filter(item => item.size > 0 && item.path && !item.path.endsWith('/'));
      setUserFiles(actualFiles.map(file => ({ key: file.path, lastModified: file.lastModified?.toLocaleString() || 'N/A' })));
    } catch (error) {
      console.error('Error fetching user files:', error);
      setUserFiles([]);
    } finally {
      setIsLoadingUserFiles(false);
    }
  }

  // Check authentication state on mount
  useEffect(() => {
    async function checkAuthState() {
      try {
        await fetchAuthSession({ forceRefresh: false });
        setIsAuthenticated(true);
        fetchQuizFiles();
        fetchUserFiles();
      } catch (e) {
        setIsAuthenticated(false);
        setQuizFiles([]);
        setUserFiles([]);
      }
    }
    checkAuthState();
  }, []);

  // Scroll to top on content/view change to keep fixed header visible
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [quizFiles, userFiles, activeView, currentQuiz]);

  // Quiz functions (generate, delete, etc.)
  async function generateSimpleQuiz(fileKey) {
    setIsGeneratingQuiz(true);
    setActiveView('quiz');
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { fileKey, task: 'generateQuiz' } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success && actualData.questions) {
        const fileName = fileKey.split('/').pop().replace(/\.(pptx?|pdf)$/i, '');
        setCurrentQuiz({ title: fileName, questions: actualData.questions, fileKey });
        setUserAnswers({});
        setShowResults(false);
      } else {
        alert('Failed to generate quiz.');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Error generating quiz.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  async function deleteQuizFile(fileKey) {
    try {
      await remove({ path: fileKey });
      fetchQuizFiles();
    } catch (error) {
      console.error('Error deleting quiz file:', error);
    }
  }

  function handleAnswerSelect(questionId, optionIndex) {
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  }

  function calculateScore() {
    if (!currentQuiz) return 0;
    let correct = 0;
    currentQuiz.questions.forEach(q => { if (userAnswers[q.id] === q.correctAnswer) correct++; });
    return correct;
  }

  function submitQuiz() {
    if (Object.keys(userAnswers).length < currentQuiz.questions.length) {
      alert('Please answer all questions!');
      return;
    }
    setShowResults(true);
  }

  function resetQuiz() {
    if (showResults && currentQuiz && currentQuiz.fileKey) deleteQuizFile(currentQuiz.fileKey);
    setCurrentQuiz(null);
    setUserAnswers({});
    setShowResults(false);
    setActiveView('dashboard');
  }

  const handleSignOut = async (signOutProvidedByAuthenticator) => {
    try {
      await signOutProvidedByAuthenticator();
      setIsAuthenticated(false);
      setQuizFiles([]);
      setUserFiles([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Summarize document
  async function handleSummarize(fileKey) {
    setIsSummarizing(true);
    setSummaryText('');
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { fileKey, task: 'summarize' } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success && actualData.summary) setSummaryText(actualData.summary);
      else setSummaryText('No summary returned.');
    } catch (error) {
      console.error('Summary error:', error);
      setSummaryText('Summary failed.');
    } finally {
      setIsSummarizing(false);
    }
  }

  // Resume generator
  async function generateResume() {
    setIsGeneratingResume(true);
    setGeneratedResume('');
    setGeneratedCoverLetter('');
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { task: 'generateResume', resumeData } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success) {
        setGeneratedResume(actualData.resume || '');
        setGeneratedCoverLetter(actualData.coverLetter || '');
      } else {
        alert(actualData.error || 'Failed to generate resume.');
      }
    } catch (error) {
      console.error('Resume generation error:', error);
      alert('Error generating resume.');
    } finally {
      setIsGeneratingResume(false);
    }
  }

  // Interview functions
  async function startInterview() {
    if (!interviewRole) {
      alert('Please enter a job role!');
      return;
    }
    setIsGeneratingInterview(true);
    setInterviewQuestions([]);
    setCurrentQuestionIndex(0);
    setInterviewFeedback('');
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { task: 'generateInterview', role: interviewRole, level: interviewLevel } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success && actualData.questions) {
        setInterviewQuestions(actualData.questions);
        setCurrentInterviewQuestion(actualData.questions[0]);
      } else {
        alert(actualData.error || 'Failed to generate interview questions.');
      }
    } catch (error) {
      console.error('Interview generation error:', error);
      alert('Error generating interview.');
    } finally {
      setIsGeneratingInterview(false);
    }
  }

  async function submitInterviewAnswer() {
    if (!interviewAnswer.trim()) {
      alert('Please provide an answer!');
      return;
    }
    setIsGeneratingInterview(true);
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { task: 'evaluateAnswer', question: currentInterviewQuestion, answer: interviewAnswer, role: interviewRole, level: interviewLevel } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success && actualData.feedback) {
        setInterviewFeedback(actualData.feedback);
      } else {
        alert(actualData.error || 'Failed to get feedback.');
      }
    } catch (error) {
      console.error('Interview evaluation error:', error);
      alert('Error evaluating answer.');
    } finally {
      setIsGeneratingInterview(false);
    }
  }

  function nextInterviewQuestion() {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < interviewQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentInterviewQuestion(interviewQuestions[nextIndex]);
      setInterviewAnswer('');
      setInterviewFeedback('');
    } else {
      alert('Interview completed! Great job! 🎉');
      setInterviewQuestions([]);
      setCurrentQuestionIndex(0);
      setInterviewAnswer('');
      setInterviewFeedback('');
    }
  }

  // Skill Gap Analysis
  async function analyzeSkillGap() {
    if (!currentSkills.trim() || !targetJobRole.trim()) {
      alert('Please fill in both fields!');
      return;
    }
    setIsAnalyzingSkills(true);
    setSkillGapResult(null);
    try {
      const restOperation = post({ apiName, path: '/EduCloud-Summarizer', options: { body: { task: 'analyzeSkillGap', currentSkills, targetRole: targetJobRole } } });
      const response = await restOperation.response;
      const data = await response.body.json();
      let actualData = data.body && typeof data.body === 'string' ? JSON.parse(data.body) : data;
      if (actualData.success) {
        setSkillGapResult({
          missingSkills: actualData.missingSkills || [],
          recommendations: actualData.recommendations || '',
          matchPercentage: actualData.matchPercentage || 0
        });
      } else {
        alert(actualData.error || 'Failed to analyze skills.');
      }
    } catch (error) {
      console.error('Skill gap analysis error:', error);
      alert('Error analyzing skills.');
    } finally {
      setIsAnalyzingSkills(false);
    }
  }

  // View rendering

  // Quiz View
  if (activeView === 'quiz' && currentQuiz) {
    const score = calculateScore();
    const totalQuestions = currentQuiz.questions.length;
    return (
      <Authenticator formFields={formFields} loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', paddingTop: '100px', overflowY: 'auto', minHeight: '100vh' }}>
            <Flex justifyContent="space-between" alignItems="center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'white', padding: '15px 30px', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <Heading level={2}>Quiz: {currentQuiz.title}</Heading>
              <Button onClick={resetQuiz} variation="link">← Back</Button>
            </Flex>
            <hr style={{ margin: '20px 0' }} />
            {!showResults ? (
              <>
                {currentQuiz.questions.map((q, qIndex) => (
                  <Card key={q.id} variation="outlined" margin="1rem 0" padding="1.5rem">
                    <Heading level={4}>Question {qIndex + 1}</Heading>
                    <Text fontSize="1.1rem" marginBottom="1rem">{q.question}</Text>
                    {q.options.map((option, optIndex) => (
                      <View key={optIndex} marginBottom="0.5rem">
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="radio" name={`question-${q.id}`} checked={userAnswers[q.id] === optIndex} onChange={() => handleAnswerSelect(q.id, optIndex)} style={{ marginRight: '10px', cursor: 'pointer' }} />
                          <Text>{option}</Text>
                        </label>
                      </View>
                    ))}
                  </Card>
                ))}
                <Button onClick={submitQuiz} variation="primary" width="100%" marginTop="2rem">Submit Quiz</Button>
              </>
            ) : (
              <>
                <Alert variation="success" heading={`Your Score: ${score} / ${totalQuestions}`} marginBottom="2rem">
                  {score === totalQuestions ? 'Perfect! 🎉' : score >= totalQuestions * 0.7 ? 'Great job! 👏' : 'Keep practicing! 💪'}
                </Alert>
                {currentQuiz.questions.map((q, qIndex) => {
                  const isCorrect = userAnswers[q.id] === q.correctAnswer;
                  return (
                    <Card key={q.id} variation="outlined" margin="1rem 0" padding="1.5rem" style={{ borderColor: isCorrect ? '#28a745' : '#dc3545', borderWidth: '2px' }}>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Heading level={4}>Question {qIndex + 1}</Heading>
                        <Text fontSize="1.2rem" fontWeight="bold" color={isCorrect ? '#28a745' : '#dc3545'}>
                          {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </Text>
                      </Flex>
                      <Text fontSize="1.1rem" marginBottom="1rem">{q.question}</Text>
                      {q.options.map((option, optIndex) => {
                        const isUserAnswer = userAnswers[q.id] === optIndex;
                        const isCorrectAnswer = q.correctAnswer === optIndex;
                        return (
                          <View key={optIndex} padding="0.5rem" marginBottom="0.5rem" backgroundColor={isCorrectAnswer ? 'rgba(40, 167, 69, 0.1)' : isUserAnswer ? 'rgba(220, 53, 69, 0.1)' : 'transparent'} borderRadius="4px">
                            <Text>{isCorrectAnswer && '✓ '}{isUserAnswer && !isCorrectAnswer && '✗ '}{option}</Text>
                          </View>
                        );
                      })}
                    </Card>
                  );
                })}
                <Button onClick={resetQuiz} variation="primary" width="100%" marginTop="2rem">Back to Dashboard</Button>
              </>
            )}
          </main>
        )}
      </Authenticator>
    );
  }

  // Resume View
  if (activeView === 'resume') {
    return (
      <Authenticator formFields={formFields} loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', paddingTop: '100px', overflowY: 'auto', minHeight: '100vh' }}>
            <Flex justifyContent="space-between" alignItems="center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'white', padding: '15px 30px', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <Heading level={2}>📝 Resume Builder</Heading>
              <Button onClick={() => setActiveView('dashboard')} variation="link">← Back</Button>
            </Flex>
            <hr style={{ margin: '20px 0' }} />
            <Card variation="outlined" padding="2rem">
              <Heading level={3} marginBottom="1rem">Your Information</Heading>
              <TextField label="Full Name" value={resumeData.fullName} onChange={(e) => setResumeData({...resumeData, fullName: e.target.value})} placeholder="John Doe" />
              <TextField label="Email" value={resumeData.email} onChange={(e) => setResumeData({...resumeData, email: e.target.value})} placeholder="john@example.com" marginTop="1rem" />
              <TextField label="Phone" value={resumeData.phone} onChange={(e) => setResumeData({...resumeData, phone: e.target.value})} placeholder="+1 234 567 8900" marginTop="1rem" />
              <TextAreaField label="Education" value={resumeData.education} onChange={(e) => setResumeData({...resumeData, education: e.target.value})} placeholder="B.S. Computer Science, XYZ University, 2024" rows={3} marginTop="1rem" />
              <TextAreaField label="Work Experience" value={resumeData.experience} onChange={(e) => setResumeData({...resumeData, experience: e.target.value})} placeholder="Software Intern at ABC Corp (2023-2024)..." rows={4} marginTop="1rem" />
              <TextAreaField label="Skills" value={resumeData.skills} onChange={(e) => setResumeData({...resumeData, skills: e.target.value})} placeholder="Python, JavaScript, React, AWS..." rows={3} marginTop="1rem" />
              <TextField label="Target Job Role" value={resumeData.targetJob} onChange={(e) => setResumeData({...resumeData, targetJob: e.target.value})} placeholder="Software Engineer" marginTop="1rem" />
              <Button onClick={generateResume} variation="primary" width="100%" marginTop="2rem" isLoading={isGeneratingResume}>Generate Resume & Cover Letter</Button>
            </Card>
            {generatedResume && (
              <Card variation="outlined" marginTop="2rem" padding="2rem">
                <Heading level={3}>Generated Resume</Heading>
                <Text whiteSpace="pre-line" marginTop="1rem">{generatedResume}</Text>
              </Card>
            )}
            {generatedCoverLetter && (
              <Card variation="outlined" marginTop="2rem" padding="2rem">
                <Heading level={3}>Generated Cover Letter</Heading>
                <Text whiteSpace="pre-line" marginTop="1rem">{generatedCoverLetter}</Text>
              </Card>
            )}
          </main>
        )}
      </Authenticator>
    );
  }

  // Interview View
  if (activeView === 'interview') {
    return (
      <Authenticator formFields={formFields} loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', paddingTop: '100px', overflowY: 'auto', minHeight: '100vh' }}>
            <Flex justifyContent="space-between" alignItems="center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'white', padding: '15px 30px', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <Heading level={2}>🎤 Mock Interviewer</Heading>
              <Button onClick={() => setActiveView('dashboard')} variation="link">← Back</Button>
            </Flex>
            <hr style={{ margin: '20px 0' }} />
            {interviewQuestions.length === 0 ? (
              <Card variation="outlined" padding="2rem">
                <Heading level={3} marginBottom="1rem">Start Your Mock Interview</Heading>
                <TextField label="Job Role" value={interviewRole} onChange={(e) => setInterviewRole(e.target.value)} placeholder="e.g., Software Engineer, Data Analyst" />
                <SelectField label="Experience Level" value={interviewLevel} onChange={(e) => setInterviewLevel(e.target.value)} marginTop="1rem">
                  <option value="entry">Entry Level</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior Level</option>
                </SelectField>
                <Button onClick={startInterview} variation="primary" width="100%" marginTop="2rem" isLoading={isGeneratingInterview}>Start Interview</Button>
              </Card>
            ) : (
              <>
                <Card variation="outlined" padding="2rem" marginBottom="2rem">
                  <Flex justifyContent="space-between" alignItems="center">
                    <Heading level={4}>Question {currentQuestionIndex + 1} of {interviewQuestions.length}</Heading>
                    <Text fontSize="0.9rem" color="gray">Role: {interviewRole} ({interviewLevel})</Text>
                  </Flex>
                  <hr style={{ margin: '15px 0' }} />
                  <Text fontSize="1.2rem" fontWeight="bold" marginBottom="1rem">{currentInterviewQuestion}</Text>
                  <TextAreaField label="Your Answer" value={interviewAnswer} onChange={(e) => setInterviewAnswer(e.target.value)} placeholder="Type your answer here..." rows={6} marginTop="1rem" />
                  <Button onClick={submitInterviewAnswer} variation="primary" width="100%" marginTop="1rem" isLoading={isGeneratingInterview} isDisabled={!interviewAnswer.trim()}>Submit Answer</Button>
                </Card>
                {interviewFeedback && (
                  <Card variation="outlined" padding="2rem">
                    <Heading level={4}>AI Feedback</Heading>
                    <Text whiteSpace="pre-line" marginTop="1rem">{interviewFeedback}</Text>
                    <Button onClick={nextInterviewQuestion} variation="primary" width="100%" marginTop="1.5rem">
                      {currentQuestionIndex + 1 < interviewQuestions.length ? 'Next Question' : 'Finish Interview'}
                    </Button>
                  </Card>
                )}
              </>
            )}
          </main>
        )}
      </Authenticator>
    );
  }

  // Skill Gap View
  if (activeView === 'skillgap') {
    return (
      <Authenticator formFields={formFields} loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', paddingTop: '100px', overflowY: 'auto', minHeight: '100vh' }}>
            <Flex justifyContent="space-between" alignItems="center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'white', padding: '15px 30px', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <Heading level={2}>🎯 Skill Gap Analysis</Heading>
              <Button onClick={() => setActiveView('dashboard')} variation="link">← Back</Button>
            </Flex>
            <hr style={{ margin: '20px 0' }} />
            <Card variation="outlined" padding="2rem">
              <Heading level={3} marginBottom="1rem">Analyze Your Skills</Heading>
              <TextAreaField label="Your Current Skills" value={currentSkills} onChange={(e) => setCurrentSkills(e.target.value)} placeholder="e.g., Python, JavaScript, React, SQL, Git..." rows={4} />
              <TextField label="Target Job Role" value={targetJobRole} onChange={(e) => setTargetJobRole(e.target.value)} placeholder="e.g., Full Stack Developer, Data Scientist" marginTop="1rem" />
              <Button onClick={analyzeSkillGap} variation="primary" width="100%" marginTop="2rem" isLoading={isAnalyzingSkills}>Analyze Skill Gap</Button>
            </Card>
            {skillGapResult && (
              <>
                <Card variation="outlined" marginTop="2rem" padding="2rem">
                  <Heading level={3}>Skill Match: {skillGapResult.matchPercentage}%</Heading>
                  <View style={{ width: '100%', height: '20px', backgroundColor: '#e0e0e0', borderRadius: '10px', marginTop: '10px', overflow: 'hidden' }}>
                    <View style={{ width: `${skillGapResult.matchPercentage}%`, height: '100%', backgroundColor: skillGapResult.matchPercentage >= 70 ? '#28a745' : '#ffc107', transition: 'width 0.5s ease' }} />
                  </View>
                </Card>
                <Card variation="outlined" marginTop="2rem" padding="2rem">
                  <Heading level={4}>Missing Skills</Heading>
                  {skillGapResult.missingSkills.length > 0 ? (
                    <ul style={{ marginTop: '10px' }}>
                      {skillGapResult.missingSkills.map((skill, idx) => (
                        <li key={idx} style={{ marginBottom: '5px' }}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <Text>You have all the required skills! 🎉</Text>
                  )}
                </Card>
                <Card variation="outlined" marginTop="2rem" padding="2rem">
                  <Heading level={4}>Learning Recommendations</Heading>
                  <Text whiteSpace="pre-line" marginTop="1rem">{skillGapResult.recommendations}</Text>
                </Card>
              </>
            )}
          </main>
        )}
      </Authenticator>
    );
  }

  // Dashboard View (default)
  return (
    <Authenticator formFields={formFields} loginMechanisms={['email']}>
      {({ signOut, user }) => (
        <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', paddingTop: '100px', overflowY: 'auto', minHeight: '100vh' }}>
          <Flex justifyContent="space-between" alignItems="center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'white', padding: '15px 30px', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <Heading level={2}>Hello, {user?.attributes?.email || user?.username}</Heading>
            <Button onClick={() => handleSignOut(signOut)} variation="primary">Sign Out</Button>
          </Flex>

          <hr style={{ margin: '20px 0' }} />
          
          <View marginBottom="3rem">
            <Heading level={3} marginBottom="1rem">🚀 Career Development Tools</Heading>
            <Flex direction={{ base: 'column', large: 'row' }} justifyContent="space-around" gap="1rem">
              <Card variation="outlined" padding="1.5rem" style={{ cursor: 'pointer', flex: 1 }} onClick={() => setActiveView('resume')}>
                <Heading level={4}>📝 Resume Builder</Heading>
                <Text marginTop="0.5rem">Create AI-optimized resumes and cover letters</Text>
              </Card>
              <Card variation="outlined" padding="1.5rem" style={{ cursor: 'pointer', flex: 1 }} onClick={() => setActiveView('interview')}>
                <Heading level={4}>🎤 Mock Interview</Heading>
                <Text marginTop="0.5rem">Practice interviews with AI feedback</Text>
              </Card>
              <Card variation="outlined" padding="1.5rem" style={{ cursor: 'pointer', flex: 1 }} onClick={() => setActiveView('skillgap')}>
                <Heading level={4}>🎯 Skill Gap Analysis</Heading>
                <Text marginTop="0.5rem">Identify skills needed for your target role</Text>
              </Card>
            </Flex>
          </View>

          <Heading level={3} marginBottom="1rem">📚 Learning Tools</Heading>
          <Flex direction={{ base: 'column', large: 'row' }} justifyContent="space-around" gap="2rem">

            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={4} marginBottom="1rem">📄 Document Summarizer</Heading>
              <StorageManager acceptedFileTypes={acceptedFileTypes} path="summaries/" maxFileCount={1} isResumable autoUpload={true} onUploadSuccess={({ key }) => setSummaryFile(key)} />
              {summaryFile && <Button onClick={() => handleSummarize(summaryFile)} isLoading={isSummarizing} marginTop="1rem">Summarize</Button>}
              {summaryText && (
                <Card variation="outlined" marginTop="1rem">
                  <Heading level={5}>Summary</Heading>
                  <Text whiteSpace="pre-line">{summaryText}</Text>
                </Card>
              )}
            </View>

            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={4} marginBottom="1rem">🧠 Quiz Generator</Heading>
              <StorageManager acceptedFileTypes={acceptedFileTypes} path="quizzes/" maxFileCount={1} isResumable autoUpload={true} onUploadSuccess={({ key }) => setTimeout(() => { fetchQuizFiles(); }, 500)} />
              <View marginTop="2rem">
                <Heading level={5}>Your Uploaded Quiz Documents</Heading>
                {isLoadingFiles ? <Text>Loading...</Text> : quizFiles.length === 0 ? <Text>Upload a document above.</Text> : quizFiles.map(file => (
                  <Card key={file.key} variation="outlined" margin="1rem 0">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>{file.key.split('/').pop()}</Text>
                      <Button variation="primary" onClick={() => generateSimpleQuiz(file.key)} isLoading={isGeneratingQuiz}>Take Quiz</Button>
                    </Flex>
                  </Card>
                ))}
              </View>
            </View>

            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={4} marginBottom="1rem">🗂️ My Files</Heading>
              <StorageManager path={({ identityId }) => `protected/${identityId}/myfiles/`} maxFileCount={10} isResumable autoUpload={true} onUploadSuccess={({ key }) => setTimeout(() => { fetchUserFiles(); }, 500)} />
              <View marginTop="2rem">
                {isLoadingUserFiles ? <Text>Loading...</Text> : userFiles.length === 0 ? <Text>No files uploaded yet.</Text> : userFiles.map(file => (
                  <Card key={file.key} variation="outlined" margin="1rem 0">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>{file.key.split('/').pop()}</Text>
                      <Button as="a" href={`https://educloudfrontend2bf38c8bc5dc4051a5746eb0aace1a63c289-cleanenv.s3.amazonaws.com/${file.key}`} target="_blank" rel="noopener noreferrer" variation="link">View</Button>
                    </Flex>
                    <Text fontSize="0.9rem" marginTop="0.5rem">Last Modified: {file.lastModified}</Text>
                  </Card>
                ))}
              </View>
            </View>

          </Flex>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
