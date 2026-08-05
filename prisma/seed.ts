import { PrismaClient, AnswerOption, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@daam.com' },
    update: {
      password: adminPassword,
      role: Role.ADMIN,
      placementTestCompleted: true,
    },
    create: {
      email: 'admin@daam.com',
      username: 'admin',
      password: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      profileCompleted: true,
      placementTestCompleted: true,
    },
  });

  const seedData = [
    {
      name: 'Math',
      lessons: [
        {
          title: 'Algebra Basics',
          description: 'Introduction to variables and basic equations.',
          youtubeUrl: 'https://www.youtube.com/watch?v=grnP3mDuRIA',
          order: 1,
          passingScore: 70,
          questions: [
            {
              question: 'What is the value of x if 2x = 10?',
              optionA: '3',
              optionB: '5',
              optionC: '8',
              optionD: '10',
              correctAnswer: AnswerOption.B,
            },
            {
              question: 'Which of the following is a variable?',
              optionA: '7',
              optionB: '3.14',
              optionC: 'x',
              optionD: '100',
              correctAnswer: AnswerOption.C,
            },
            {
              question: 'Simplify: 3x + 2x',
              optionA: '6x',
              optionB: '5x',
              optionC: 'x^2',
              optionD: '5',
              correctAnswer: AnswerOption.B,
            },
          ],
        },
        {
          title: 'Geometry Introduction',
          description: 'Understanding points, lines, shapes, and angles.',
          youtubeUrl: 'https://www.youtube.com/watch?v=302eJ3TzJQU',
          order: 2,
          passingScore: 75,
          questions: [
            {
              question: 'How many degrees are in a right angle?',
              optionA: '45',
              optionB: '180',
              optionC: '90',
              optionD: '360',
              correctAnswer: AnswerOption.C,
            },
            {
              question: 'What is the sum of angles in a triangle?',
              optionA: '90°',
              optionB: '360°',
              optionC: '270°',
              optionD: '180°',
              correctAnswer: AnswerOption.D,
            },
          ],
        },
      ],
    },
    {
      name: 'Arabic',
      lessons: [
        {
          title: 'Arabic Alphabet',
          description: 'Learn how to read and write the 28 letters of the Arabic alphabet.',
          youtubeUrl: 'https://www.youtube.com/watch?v=7c1Qc-rA7G0',
          order: 1,
          passingScore: 60,
          questions: [
            {
              question: 'How many letters are in the Arabic alphabet?',
              optionA: '24',
              optionB: '26',
              optionC: '28',
              optionD: '30',
              correctAnswer: AnswerOption.C,
            },
            {
              question: 'Arabic is written from:',
              optionA: 'Left to Right',
              optionB: 'Right to Left',
              optionC: 'Top to Bottom',
              optionD: 'Bottom to Top',
              correctAnswer: AnswerOption.B,
            },
          ],
        },
      ],
    },
    {
      name: 'French',
      lessons: [
        {
          title: 'French Greetings',
          description: 'Learn basic greetings and introductions in French.',
          youtubeUrl: 'https://www.youtube.com/watch?v=hcEIXZ81q_Q',
          order: 1,
          passingScore: 65,
          questions: [
            {
              question: 'How do you say "Good morning" in French?',
              optionA: 'Bonsoir',
              optionB: 'Bonjour',
              optionC: 'Bonne nuit',
              optionD: 'Salut',
              correctAnswer: AnswerOption.B,
            },
            {
              question: 'What does "Comment vous appelez-vous?" mean?',
              optionA: 'How are you?',
              optionB: 'Where are you from?',
              optionC: 'What is your name?',
              optionD: 'How old are you?',
              correctAnswer: AnswerOption.C,
            },
          ],
        },
      ],
    },
  ];

  for (const s of seedData) {
    const schoolLevel = (s as any).schoolLevel || 1;
    const subject = await prisma.subject.upsert({
      where: { name_schoolLevel: { name: s.name, schoolLevel } },
      update: {},
      create: { name: s.name, schoolLevel },
    });

    for (const l of s.lessons) {
      const { questions, ...lessonData } = l;

      let lesson = await prisma.lesson.findFirst({
        where: { title: lessonData.title, subjectId: subject.id },
      });

      if (!lesson) {
        lesson = await prisma.lesson.create({
          data: { ...lessonData, subjectId: subject.id },
        });
      }

      for (const q of questions) {
        const existing = await prisma.quizQuestion.findFirst({
          where: { question: q.question, lessonId: lesson.id },
        });
        if (!existing) {
          await prisma.quizQuestion.create({
            data: { ...q, lessonId: lesson.id },
          });
        }
      }
    }
  }

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
