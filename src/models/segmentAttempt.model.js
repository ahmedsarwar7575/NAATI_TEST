import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const SegmentAttempt = sequelize.define(
  "SegmentAttempt",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    examAttemptId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    segmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

    audioUrl: { type: DataTypes.TEXT, allowNull: true },
    userTranscription: { type: DataTypes.TEXT, allowNull: true },

    aiScores: { type: DataTypes.JSON, allowNull: true },

    accuracyScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    overallScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    feedback: { type: DataTypes.TEXT, allowNull: true },

    languageQualityScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    languageQualityText: { type: DataTypes.TEXT, allowNull: true },

    fluencyPronunciationScore: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    fluencyPronunciationText: { type: DataTypes.TEXT, allowNull: true },

    deliveryCoherenceScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    deliveryCoherenceText: { type: DataTypes.TEXT, allowNull: true },

    culturalControlScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    culturalControlText: { type: DataTypes.TEXT, allowNull: true },

    responseManagementScore: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    responseManagementText: { type: DataTypes.TEXT, allowNull: true },

    totalRawScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    finalScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    oneLineFeedback: { type: DataTypes.TEXT, allowNull: true },
    language: { type: DataTypes.TEXT, allowNull: true },

    repeatCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  },
  {
    tableName: "segment_attempts",
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["exam_attempt_id", "segment_id", "repeat_count"],
      },
    ],
  }
);

export default SegmentAttempt;
