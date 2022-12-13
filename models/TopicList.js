const mongoose = require("mongoose");

const topicListSchema = new mongoose.Schema({
  username: {type:String, required: true},
  topicList: {type:Array, required: true}
});

const TopicList = mongoose.model("TopicList",topicListSchema)

module.exports = TopicList;
