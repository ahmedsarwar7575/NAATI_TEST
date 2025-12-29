import { DataTypes } from "sequelize";
import {sequelize} from "../config/db.js";

const ExamAttempt = sequelize.define(
  "ExamAttempt",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    dialogueId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    examType: { type: DataTypes.ENUM("rapid_review", "complete_dialogue"), allowNull: false },
    status: { type: DataTypes.ENUM("in_progress", "completed"), allowNull: false, defaultValue: "in_progress" }
  },
  { tableName: "exam_attempts", underscored: true, timestamps: true }
);

export default ExamAttempt;
