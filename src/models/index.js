import { User } from "./user.model.js";
import { Language } from "./language.model.js";
import { Domain } from "./domain.model.js";
import { Dialogue } from "./dialogue.model.js";
import { Segment } from "./segment.model.js";
import ExamAttempt from "./examAttempt.model.js";
import SegmentAttempt from "./segmentAttempt.model.js";
import ExamImage from "./examImage.model.js";
import { Subscription } from "./subscription.model.js";
import { Transaction } from "./transaction.model.js";


Language.hasMany(Domain, { foreignKey: "languageId", onDelete: "CASCADE", onUpdate: "CASCADE" });
Domain.belongsTo(Language, { foreignKey: "languageId" });

Language.hasMany(Dialogue, { foreignKey: "languageId", onDelete: "CASCADE", onUpdate: "CASCADE" });
Dialogue.belongsTo(Language, { foreignKey: "languageId" });

Domain.hasMany(Dialogue, { foreignKey: "domainId", onDelete: "CASCADE", onUpdate: "CASCADE" });
Dialogue.belongsTo(Domain, { foreignKey: "domainId" });

Dialogue.hasMany(Segment, { foreignKey: "dialogueId", onDelete: "CASCADE", onUpdate: "CASCADE" });
Segment.belongsTo(Dialogue, { foreignKey: "dialogueId" });

User.hasMany(ExamAttempt, { foreignKey: "userId", onDelete: "CASCADE" });
ExamAttempt.belongsTo(User, { foreignKey: "userId" });

Dialogue.hasMany(ExamAttempt, { foreignKey: "dialogueId", onDelete: "CASCADE" });
ExamAttempt.belongsTo(Dialogue, { foreignKey: "dialogueId" });

ExamAttempt.hasMany(SegmentAttempt, { foreignKey: "examAttemptId", onDelete: "CASCADE" });
SegmentAttempt.belongsTo(ExamAttempt, { foreignKey: "examAttemptId" });

Segment.hasMany(SegmentAttempt, { foreignKey: "segmentId", onDelete: "CASCADE" });
SegmentAttempt.belongsTo(Segment, { foreignKey: "segmentId" });

User.hasMany(SegmentAttempt, { foreignKey: "userId", onDelete: "CASCADE" });
SegmentAttempt.belongsTo(User, { foreignKey: "userId" });

ExamAttempt.hasMany(ExamImage, { foreignKey: "examAttemptId", onDelete: "CASCADE" });
ExamImage.belongsTo(ExamAttempt, { foreignKey: "examAttemptId" });

User.hasMany(ExamImage, { foreignKey: "userId", onDelete: "CASCADE" });
ExamImage.belongsTo(User, { foreignKey: "userId" });

Segment.hasMany(ExamImage, { foreignKey: "segmentId", onDelete: "SET NULL" });
ExamImage.belongsTo(Segment, { foreignKey: "segmentId" });
User.hasOne(Subscription, { foreignKey: "userId", onDelete: "CASCADE" });
Subscription.belongsTo(User, { foreignKey: "userId" });


User.hasMany(Transaction, { foreignKey: "userId", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "userId" });

// optional (nice)
Subscription.hasMany(Transaction, { foreignKey: "stripeSubscriptionId", sourceKey: "stripeSubscriptionId" });
export const models = { User, Language, Domain, Dialogue, Segment, ExamAttempt, SegmentAttempt, ExamImage, Subscription, Transaction };
