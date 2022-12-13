const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  topic: {type:String, required: true},
  title: {type:String, required: true},
  dateCreated: {type: String, required: true},
  dateUpdated: {type: String, required: false},
  ownerName: {type: String, required: true},
  content:{type:String, required: true},
  tags:{type:Array, required:true}
});

const Note = mongoose.model("Note", noteSchema)

module.exports = Note;
