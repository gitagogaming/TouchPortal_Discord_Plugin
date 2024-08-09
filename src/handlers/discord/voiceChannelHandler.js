const {logIt, wait, imageToBase64} = require("../../utils/helpers.js");


class VoiceChannelHandler {
  constructor(DG, TPClient, userStateHandler) {
    this.DG = DG;
    this.TPClient = TPClient;
    this.userStateHandler = userStateHandler;
  }


  voiceChannel = async (data, userStateHandler) => {
    logIt("DEBUG", "Voice Channel join", JSON.stringify(data));
  
    //  await DiscordClient.subscribe("MESSAGE_CREATE", { channel_id: "1125087354969915464"}).catch((err) => {logIt("ERROR",err)});
    await userStateHandler.clearUserStates();
    await this.unsubscribeFromEvents();
  
    if (data.channel_id == null) {
      this.DG.voiceChannelInfo.voice_channel_name = "<None>";
      this.DG.voiceChannelInfo.voice_channel_id = "<None>";
      this.DG.voiceChannelInfo.voice_channel_server_id = "<None>";
      this.DG.voiceChannelInfo.voice_channel_server_name = "<None>";
      this.DG.voiceChannelInfo.voice_channel_participants = "<None>";
      this.DG.voiceChannelInfo.voice_channel_participant_ids = "<None>";
    } else if (data.guild_id == null) {
      this.DG.voiceChannelInfo.voice_channel_id = data.channel_id;
      this.DG.voiceChannelInfo.voice_channel_name = "Personal";
      this.DG.voiceChannelInfo.voice_channel_server_id = "Personal";
      this.DG.voiceChannelInfo.voice_channel_server_name = "Personal";
  
      // Subscribe to voice channel events
      await this.subscribeToEvents(data.channel_id);
    } else {
      // Lookup Voice Channel Name
      if (!this.DG.channels[data.guild_id] || !this.DG.channels[data.guild_id].voice) {
  
  
        /// This should be referring to voicestateHandler... but its not.. so its literally doin nothing right now..
        try {
          // if user changes channels while plugin is booting, it may error/crash without this..
          getGuildChannels(data.guild_id).then(() => {
            if (this.DG.channels[data.guild_id] && this.DG.channels[data.guild_id].voice) {
              this.DG.voiceChannelInfo.voice_channel_name = this.DG.channels[data.guild_id].voice.names[data.channel_id];
            }
          });
        } catch (error) {
          logIt("ERROR", "Error getting Guild Channels", error);
        }
  
      } else {
        this.DG.voiceChannelInfo.voice_channel_name = this.DG.channels[data.guild_id].voice.names[data.channel_id];
      }
  
      this.DG.voiceChannelInfo.voice_channel_id = data.channel_id;
      this.DG.voiceChannelInfo.voice_channel_server_id = data.guild_id;
  
      try {
        // was getting times where the guilds.idx was not available on a fresh boot
        this.DG.voiceChannelInfo.voice_channel_server_name = this.DG.guilds.idx[data.guild_id];
      } catch (error) {
        // Call getGuilds function to initialize guilds in case it's not available
        this.DG.guilds = await getGuilds();
        this.DG.voiceChannelInfo.voice_channel_server_name = this.DG.guilds.idx[data.guild_id];
      }
  
      logIt(
        "DEBUG",
        "Subscribing to Voice Channel [",
        this.DG.voiceChannelInfo.voice_channel_name,
        "] with ID [",
        this.DG.voiceChannelInfo.voice_channel_id,
        "] on Server [",
        this.DG.voiceChannelInfo.voice_channel_server_name,
        "] with ID [",
        this.DG.voiceChannelInfo.voice_channel_server_id,
        "]"
      );
  
      // Subscribe to voice channel events
      await this.subscribeToEvents(data.channel_id);
  
      logIt("DEBUG", "COMPLETE - Subscribing to Voice Channel");
    }
  
    // when we first join a channel, or plugin launches we get the voice states of the users in the channel
    // console.time('for...of');
    if (this.DG.voiceChannelInfo.voice_channel_id !== "<None>") {
      let ids = [];
      let avatarUrl;
      const channel = await this.DG.Client.getChannel(this.DG.voiceChannelInfo.voice_channel_id);
  
      await Promise.all(
        channel.voice_states.map(async (vs) => {
          if (vs.user.id !== this.DG.Client.user.id) {
            logIt("DEBUG", "User VS: ", vs, "User: ", vs.user.username);
  
            vs.speaking = false; // adding speaking to the object to track speaking status
            if (vs.user.avatar === null) {
              vs.user.base64Avatar = this.DG.DEFAULT_BASE64_AVATAR;
            } else if (vs.user.avatar !== null) {
              avatarUrl = `https://cdn.discordapp.com/avatars/${vs.user.id}/${vs.user.avatar}.webp?size=128`;
  
              vs.user.base64Avatar = await imageToBase64(avatarUrl);
            }
  
            this.DG.currentVoiceUsers[vs.user.id] = vs;
          }
        })
      );
      // console.timeEnd('for...of');
  
      this.DG.voiceChannelInfo.voice_channel_participants =
        Object.keys(this.DG.currentVoiceUsers).length > 0
          ? Object.keys(this.DG.currentVoiceUsers).join("|")
          : "<None>";
      Object.keys(this.DG.currentVoiceUsers).forEach((key, i) => {
        // Making sure not to add Client User to the list as it's not needed and would likely cause issues being in the flow of things for certain actions that cant be used on the client user
        if (this.DG.currentVoiceUsers[key].user.id !== this.DG.Client.user.id) {
          ids.push(this.DG.currentVoiceUsers[key].user.id);
          // When we join a voice channel, update the states for all users in the channel
          this.TPClient.stateUpdateMany([
            {id: [`user_${i}_Speaking`], value: "Off"},
            {id: [`user_${i}_id`], value: this.DG.currentVoiceUsers[key].user.id},
            {id: [`user_${i}_nick`], value: this.DG.currentVoiceUsers[key].nick},
            { id: [`user_${i}_mute`],  value: this.DG.currentVoiceUsers[key].mute ? "On" : "Off"},
            { id: [`user_${i}_deaf`], value: this.DG.currentVoiceUsers[key].voice_state.deaf ? "On" : "Off"},
            { id: [`user_${i}_self_deaf`], value: this.DG.currentVoiceUsers[key].voice_state.self_deaf ? "On" : "Off"},
            { id: [`user_${i}_self_mute`], value: this.DG.currentVoiceUsers[key].voice_state.self_mute ? "On" : "Off"},
            { id: [`user_${i}_server_mute`], value: this.DG.currentVoiceUsers[key].voice_state.mute ? "On" : "Off"},
            { id: [`user_${i}_avatar`], value: this.DG.currentVoiceUsers[key].user.base64Avatar},
            { id: [`user_${i}_avatarID`], value: this.DG.currentVoiceUsers[key].user.avatar},
            {id: [`user_${i}_volume`], value: this.DG.currentVoiceUsers[key].volume},
          ]);
        }
      });
      this.DG.voiceChannelInfo.voice_channel_participant_ids = ids.length > 0 ? ids.join("|") : "<None>";
    }
  
    let states = [
      {id: "discord_voice_channel_name", value: this.DG.voiceChannelInfo.voice_channel_name},
      {id: "discord_voice_channel_id", value: this.DG.voiceChannelInfo.voice_channel_id},
      { id: "discord_voice_channel_server_name", value: this.DG.voiceChannelInfo.voice_channel_server_name},
      {id: "discord_voice_channel_server_id", value: this.DG.voiceChannelInfo.voice_channel_server_id},
      { id: "discord_voice_channel_participants", value: this.DG.voiceChannelInfo.voice_channel_participants},
      { id: "discord_voice_channel_participant_ids", value: this.DG.voiceChannelInfo.voice_channel_participant_ids},
    ];

    this.TPClient.stateUpdateMany(states);
  };


  subscribeToEvents = async (channelId) => {
    const events = [
      {name: "VOICE_STATE_CREATE", description: "Voice State Create"},
      {name: "VOICE_STATE_UPDATE", description: "Voice State Update"},
      {name: "VOICE_STATE_DELETE", description: "Voice State Delete"},
      {name: "SPEAKING_START", description: "Speaking Start"},
      {name: "SPEAKING_STOP", description: "Speaking Stop"},
    ];
  
    for (let event of events) {
      const subscription = await this.DG.Client.subscribe(event.name, {
        channel_id: channelId,
      }).catch((err) => {
        logIt("ERROR", err);
      });
      logIt("DEBUG", `Subscribed to ${event.description}`);
      this.DG.voiceChannelInfo.last_voice_channel_subs.push({
        subscription,
        description: event.description,
      });

      let eventKeys = Object.keys(events);
      logIt("DEBUG", "Subscribed to Voice Channel Events", eventKeys);
      await wait(0.15);
    }
  }

  unsubscribeFromEvents = async () => {
    if (this.DG.voiceChannelInfo.last_voice_channel_subs.length > 0) {
      logIt("DEBUG", "START - Unsubscribing from Voice Channel voice states");
      for (let i = 0; i < this.DG.voiceChannelInfo.last_voice_channel_subs.length; i++) {
        logIt("DEBUG", `Unsubscribing from ${this.DG.voiceChannelInfo.last_voice_channel_subs[i].description}`);
        // await this.DG.voiceChannelInfo.last_voice_channel_subs[i].unsubscribe();
        // took off await and it fixed the unsubscribe issue/subscribe
        this.DG.voiceChannelInfo.last_voice_channel_subs[i].subscription.unsubscribe();
  
        await wait(0.15);
      }
  
      logIt("INFO", "COMPLETE - Unsubscribing from Voice Channel voice states");
      this.DG.voiceChannelInfo.last_voice_channel_subs = [];
      this.DG.currentVoiceUsers = {};
      await wait(0.15);
    }
  };
  
}


module.exports = {VoiceChannelHandler};
