const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const cooldowns = new Map();
const cooldownTimers = new Map();
const warningTimers = new Map();
const messageCache = new Map();
const channelCache = new Map();

const MAX_CACHE_SIZE = 100;
const CACHE_CLEANUP_INTERVAL = 300000;
const MAX_COOLDOWN_DURATION = 7200000;

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

const shops = Object.freeze([
    'ร้านทะเลทราย',
    'ร้านไก่'
]);
const shopChoices = shops.map(shop => ({ name: shop, value: shop }));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    allowedMentions: { parse: [] },
    partials: [],
    makeCache: (manager) => {
        if (manager.name === 'GuildManager') return new Map();
        if (manager.name === 'ChannelManager') return new Map();
        if (manager.name === 'MessageManager') return new Map();
        return new Map();
    }
});

client.once('ready', async () => {
    console.log(`บอทพร้อมใช้งานแล้ว! เข้าสู่ระบบในชื่อ ${client.user.tag}`);
    const commands = [
        new SlashCommandBuilder()
            .setName('cooldown')
            .setDescription('ตั้งเวลาคูลดาวน์ให้ร้าน')
            .addStringOption(option =>
                option.setName('shop')
                    .setDescription('เลือกร้าน')
                    .setRequired(true)
                    .addChoices(...shopChoices))
            .addIntegerOption(option =>
                option.setName('minutes')
                    .setDescription('จำนวนนาที (1-120)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(120)),
        new SlashCommandBuilder()
            .setName('check_cooldown')
            .setDescription('ตรวจสอบสถานะคูลดาวน์ของทุกร้าน'),
        new SlashCommandBuilder()
            .setName('cancel_cooldown')
            .setDescription('ยกเลิกคูลดาวน์ร้านที่เลือก')
            .addStringOption(option =>
                option.setName('shop')
                    .setDescription('เลือกร้านที่จะยกเลิก')
                    .setRequired(true)
                    .addChoices(...shopChoices)),
        new SlashCommandBuilder()
            .setName('sync')
            .setDescription('บังคับซิงค์คำสั่งแบบ Slash (สำหรับแอดมิน)'),
        new SlashCommandBuilder()
            .setName('check_permissions')
            .setDescription('ตรวจสอบสิทธิ์ของบอทในช่องนี้')
    ];
    try {
        console.log('เริ่มรีเฟรชคำสั่งแอปพลิเคชัน (/) ');
        await client.application.commands.set(commands);
        console.log('รีโหลดคำสั่งแอปพลิเคชัน (/) สำเร็จแล้ว');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
    }
});

function formatTimeRemaining(endTime) {
    const remaining = endTime - Date.now();
    if (remaining <= 0) return 'หมดเวลาแล้ว';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')} นาที`;
}

function createCooldownEmbed(shop, minutes, endTime, username) {
    const thailandTime = new Date(endTime);
    const timeString = dateFormatter.format(thailandTime);
    return new EmbedBuilder()
        .setColor(0xff9500)
        .setTitle(`🕐 ตั้งคูลดาวน์ร้าน${shop}`)
        .setDescription('**กำลังคูลดาวน์**')
        .addFields(
            { name: '⏰ เวลาที่ตั้ง', value: `${minutes} นาที`, inline: false },
            { name: '⏳ เหลือเวลา', value: formatTimeRemaining(endTime), inline: false },
            { name: '✅ เสร็จสิ้นเมื่อ', value: `${timeString} (เวลาไทย)`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `กำหนดโดย ${username}` });
}

function cleanupCooldown(shop) {
    cooldowns.delete(shop);
    if (cooldownTimers.has(shop)) {
        clearTimeout(cooldownTimers.get(shop));
        cooldownTimers.delete(shop);
    }
    if (warningTimers.has(shop)) {
        clearTimeout(warningTimers.get(shop));
        warningTimers.delete(shop);
    }
    const cooldownData = cooldowns.get(shop);
    if (cooldownData) {
        const messageKey = `${cooldownData.channelId}-${cooldownData.messageId}`;
        messageCache.delete(messageKey);
    }
}

function cleanupCaches() {
    if (messageCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(messageCache.entries());
        const keepEntries = entries.slice(-Math.floor(MAX_CACHE_SIZE / 2));
        messageCache.clear();
        keepEntries.forEach(([key, value]) => messageCache.set(key, value));
    }
    if (channelCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(channelCache.entries());
        const keepEntries = entries.slice(-Math.floor(MAX_CACHE_SIZE / 2));
        channelCache.clear();
        keepEntries.forEach(([key, value]) => channelCache.set(key, value));
    }
    console.log(`Cache cleanup: Messages=${messageCache.size}, Channels=${channelCache.size}, Cooldowns=${cooldowns.size}`);
}

function forceGarbageCollection() {
    if (global.gc) {
        global.gc();
        console.log('Manual garbage collection triggered');
    }
}

async function getCachedChannel(channelId) {
    if (channelCache.has(channelId)) {
        return channelCache.get(channelId);
    }
    try {
        const channel = await client.channels.fetch(channelId);
        channelCache.set(channelId, channel);
        if (channelCache.size > MAX_CACHE_SIZE) {
            const firstKey = channelCache.keys().next().value;
            channelCache.delete(firstKey);
        }
        return channel;
    } catch (error) {
        return null;
    }
}

async function getCachedMessage(channel, messageId) {
    const cacheKey = `${channel.id}-${messageId}`;
    if (messageCache.has(cacheKey)) {
        return messageCache.get(cacheKey);
    }
    try {
        const message = await channel.messages.fetch(messageId);
        messageCache.set(cacheKey, message);
        if (messageCache.size > MAX_CACHE_SIZE) {
            const firstKey = messageCache.keys().next().value;
            messageCache.delete(firstKey);
        }
        return message;
    } catch (error) {
        return null;
    }
}

async function handleCooldownCompletion(shop, channelId, messageId) {
    try {
        const channel = await getCachedChannel(channelId);
        if (!channel) {
            cleanupCooldown(shop);
            return;
        }
        const message = await getCachedMessage(channel, messageId);
        if (!message) {
            cleanupCooldown(shop);
            return;
        }
        const completionMessage = await channel.send(`🔔 **${shop}** พร้อมใช้งานแล้ว!`);
        const cleanupPromises = [
            new Promise(resolve => setTimeout(async () => {
                try { await message.delete(); } catch {}
                resolve();
            }, 5000)),
            new Promise(resolve => setTimeout(async () => {
                try { await completionMessage.delete(); } catch {}
                resolve();
            }, 10000))
        ];
        cleanupCooldown(shop);
        Promise.allSettled(cleanupPromises);
    } catch (error) {
        if (error.code === 50001 || error.code === 10008 || error.code === 10003) {
            console.log(`ทำความสะอาดคูลดาวน์ ${shop} เนื่องจากไม่สามารถเข้าถึงข้อความได้ (completion)`);
        } else {
            console.error('เกิดข้อผิดพลาดในการจัดการคูลดาวน์เสร็จสิ้น:', error);
        }
        cleanupCooldown(shop);
    }
}

async function handle5MinuteWarning(shop, channelId) {
    try {
        const channel = await getCachedChannel(channelId);
        if (!channel) return;
        const warningMessage = await channel.send(`⚠️ **${shop}** จะพร้อมใช้งานในอีก 5 นาที!`);
        setTimeout(async () => {
            try { await warningMessage.delete(); } catch {}
        }, 300000);
    } catch (error) {
        if (error.code === 50001 || error.code === 10008 || error.code === 10003) {
            console.log(`ไม่สามารถส่งการแจ้งเตือน 5 นาทีสำหรับ ${shop} เนื่องจากไม่สามารถเข้าถึงช่องได้`);
        } else {
            console.error('เกิดข้อผิดพลาดในการส่งการแจ้งเตือน 5 นาที:', error);
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    try {
        if (commandName === 'cooldown') {
            const shop = interaction.options.getString('shop');
            const minutes = interaction.options.getInteger('minutes');
            const startTime = Date.now();
            const endTime = startTime + (minutes * 60 * 1000);
            if (minutes * 60 * 1000 > MAX_COOLDOWN_DURATION) {
                await interaction.reply({
                    content: `❌ เวลาคูลดาวน์สูงสุดคือ ${MAX_COOLDOWN_DURATION / 60000} นาที`,
                    flags: 64
                });
                return;
            }
            if (cooldowns.has(shop)) {
                await interaction.reply({
                    content: `❌ **${shop}** กำลังคูลดาวน์อยู่แล้ว! ใช้ \`/cancel_cooldown\` เพื่อยกเลิก`,
                    flags: 64
                });
                return;
            }
            const embed = createCooldownEmbed(shop, minutes, endTime, interaction.user.username);
            const response = await interaction.reply({ embeds: [embed] });
            const message = await interaction.fetchReply();
            cooldowns.set(shop, {
                startTime,
                endTime,
                originalMinutes: minutes,
                channelId: interaction.channelId,
                messageId: message.id,
                userId: interaction.user.id,
                username: interaction.user.username
            });
            const completionTimer = setTimeout(() => {
                handleCooldownCompletion(shop, interaction.channelId, message.id);
            }, minutes * 60 * 1000);
            cooldownTimers.set(shop, completionTimer);
            if (minutes > 5) {
                const warningTimer = setTimeout(() => {
                    handle5MinuteWarning(shop, interaction.channelId);
                }, (minutes - 5) * 60 * 1000);
                warningTimers.set(shop, warningTimer);
            }
        } else if (commandName === 'check_cooldown') {
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('🏪 สถานะคูลดาวน์ทุกร้าน')
                .setTimestamp();
            let description = '';
            let hasActiveCooldowns = false;
            for (const shop of shops) {
                if (cooldowns.has(shop)) {
                    const cooldownData = cooldowns.get(shop);
                    const timeLeft = formatTimeRemaining(cooldownData.endTime);
                    description += `🔴 **${shop}**: ${timeLeft}\n`;
                    hasActiveCooldowns = true;
                } else {
                    description += `🟢 **${shop}**: พร้อมใช้งาน\n`;
                }
            }
            if (!hasActiveCooldowns) {
                embed.setColor(0x00ff00);
                embed.setDescription('🎉 ทุกร้านพร้อมใช้งาน!');
            } else {
                embed.setDescription(description);
            }
            await interaction.reply({ embeds: [embed] });
        } else if (commandName === 'cancel_cooldown') {
            const shop = interaction.options.getString('shop');
            if (!cooldowns.has(shop)) {
                await interaction.reply({
                    content: `❌ **${shop}** ไม่มีคูลดาวน์ที่ต้องยกเลิก`,
                    flags: 64
                });
                return;
            }
            const cooldownData = cooldowns.get(shop);
            if (cooldownTimers.has(shop)) {
                clearTimeout(cooldownTimers.get(shop));
                cooldownTimers.delete(shop);
            }
            if (warningTimers.has(shop)) {
                clearTimeout(warningTimers.get(shop));
                warningTimers.delete(shop);
            }
            try {
                const channel = await getCachedChannel(cooldownData.channelId);
                const message = channel ? await getCachedMessage(channel, cooldownData.messageId) : null;
                if (message) {
                    const cancelledEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ คูลดาวน์ถูกยกเลิก')
                        .setDescription(`**${shop}** พร้อมใช้งานแล้ว`)
                        .setTimestamp()
                        .setFooter({ text: `ยกเลิกโดย ${interaction.user.username}` });
                    await message.edit({ embeds: [cancelledEmbed] });
                }
            } catch (error) {
                if (error.code === 50001 || error.code === 10008 || error.code === 10003) {
                    console.log(`ไม่สามารถอัปเดตข้อความยกเลิกสำหรับ ${shop} เนื่องจากไม่สามารถเข้าถึงได้`);
                } else {
                    console.error('เกิดข้อผิดพลาดในการอัปเดตข้อความที่ยกเลิก:', error);
                }
            }
            cooldowns.delete(shop);
            await interaction.reply({
                content: `✅ ยกเลิกคูลดาวน์ **${shop}** เรียบร้อยแล้ว`,
                flags: 64
            });
        } else if (commandName === 'sync') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (ต้องเป็น Administrator)',
                    flags: 64
                });
                return;
            }
            await interaction.deferReply({ flags: 64 });
            try {
                const commands = [
                    new SlashCommandBuilder()
                        .setName('cooldown')
                        .setDescription('ตั้งเวลาคูลดาวน์ให้ร้าน')
                        .addStringOption(option =>
                            option.setName('shop')
                                .setDescription('เลือกร้าน')
                                .setRequired(true)
                                .addChoices(...shops.map(shop => ({ name: shop, value: shop }))))
                        .addIntegerOption(option =>
                            option.setName('minutes')
                                .setDescription('จำนวนนาที (1-120)')
                                .setRequired(true)
                                .setMinValue(1)
                                .setMaxValue(120)),
                    new SlashCommandBuilder()
                        .setName('check_cooldown')
                        .setDescription('ตรวจสอบสถานะคูลดาวน์ของทุกร้าน'),
                    new SlashCommandBuilder()
                        .setName('cancel_cooldown')
                        .setDescription('ยกเลิกคูลดาวน์ร้านที่เลือก')
                        .addStringOption(option =>
                            option.setName('shop')
                                .setDescription('เลือกร้านที่จะยกเลิก')
                                .setRequired(true)
                                .addChoices(...shops.map(shop => ({ name: shop, value: shop })))),
                    new SlashCommandBuilder()
                        .setName('sync')
                        .setDescription('บังคับซิงค์คำสั่งแบบ Slash (สำหรับแอดมิน)'),
                    new SlashCommandBuilder()
                        .setName('check_permissions')
                        .setDescription('ตรวจสอบสิทธิ์ของบอทในช่องนี้')
                ];
                await client.application.commands.set(commands);
                await interaction.editReply('✅ ซิงค์คำสั่งแบบ Slash เรียบร้อยแล้ว!');
            } catch (error) {
                console.error('Error syncing commands:', error);
                await interaction.editReply('❌ เกิดข้อผิดพลาดในการซิงค์คำสั่ง');
            }
        } else if (commandName === 'check_permissions') {
            if (!interaction.guild) {
                await interaction.reply({
                    content: '❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น',
                    flags: 64
                });
                return;
            }
            const botMember = interaction.guild.members.cache.get(client.user.id);
            if (!botMember) {
                await interaction.reply({
                    content: '❌ ไม่สามารถหาข้อมูลบอทในเซิร์ฟเวอร์นี้ได้',
                    flags: 64
                });
                return;
            }
            const channel = interaction.channel;
            const requiredPermissions = [
                { name: 'ส่งข้อความ', flag: PermissionFlagsBits.SendMessages },
                { name: 'แนบลิงก์', flag: PermissionFlagsBits.EmbedLinks },
                { name: 'ใช้คำสั่งแบบ Slash', flag: PermissionFlagsBits.UseApplicationCommands },
                { name: 'อ่านประวัติข้อความ', flag: PermissionFlagsBits.ReadMessageHistory },
                { name: 'เพิ่มรีแอคชั่น', flag: PermissionFlagsBits.AddReactions }
            ];
            let permissionStatus = '';
            let missingPermissions = [];
            for (const perm of requiredPermissions) {
                const hasPermission = botMember.permissionsIn(channel).has(perm.flag);
                if (hasPermission) {
                    permissionStatus += `✅ ${perm.name}\n`;
                } else {
                    permissionStatus += `❌ ${perm.name}\n`;
                    missingPermissions.push(perm.name);
                }
            }
            const embed = new EmbedBuilder()
                .setColor(missingPermissions.length > 0 ? 0xff0000 : 0x00ff00)
                .setTitle('🔐 สถานะสิทธิ์บอท')
                .setDescription(permissionStatus)
                .setTimestamp();
            if (missingPermissions.length > 0) {
                embed.addFields({
                    name: '⚠️ คำแนะนำการแก้ไข',
                    value: 'ให้แอดมิน Server ไปที่ การตั้งค่าเซิร์ฟเวอร์ > บทบาท > เลือกบทบาทของบอท > แล้วเปิดสิทธิ์ที่ขาด'
                });
            } else {
                embed.addFields({
                    name: '🎉 สถานะ',
                    value: 'บอทมีสิทธิ์ครบถ้วนแล้ว!'
                });
            }
            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการจัดการคำสั่ง Slash:', error);
        const errorMessage = 'เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่';
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMessage });
        } else {
            await interaction.reply({ content: errorMessage, flags: 64 });
        }
    }
});

setInterval(async () => {
    if (cooldowns.size === 0) return;
    const currentTime = Date.now();
    const expiredShops = [];
    const updatePromises = [];
    for (const [shop, cooldownData] of cooldowns.entries()) {
        const timeLeft = cooldownData.endTime - currentTime;
        if (timeLeft <= 0) {
            expiredShops.push(shop);
            continue;
        }
        updatePromises.push(
            (async () => {
                try {
                    const channel = await getCachedChannel(cooldownData.channelId);
                    if (!channel) {
                        expiredShops.push(shop);
                        return;
                    }
                    const message = await getCachedMessage(channel, cooldownData.messageId);
                    if (!message) {
                        expiredShops.push(shop);
                        return;
                    }
                    const embed = createCooldownEmbed(shop, cooldownData.originalMinutes, cooldownData.endTime, cooldownData.username);
                    await message.edit({ embeds: [embed] });
                } catch (error) {
                    if (error.code === 50001 || error.code === 10008 || error.code === 10003) {
                        expiredShops.push(shop);
                    } else {
                        console.error(`เกิดข้อผิดพลาดในการรีเฟรชข้อความคูลดาวน์สำหรับ ${shop}:`, error);
                    }
                }
            })()
        );
    }
    await Promise.allSettled(updatePromises);
    for (const shop of expiredShops) {
        console.log(`ทำความสะอาดคูลดาวน์ ${shop} เนื่องจากไม่สามารถเข้าถึงข้อความได้`);
        cleanupCooldown(shop);
    }
}, 5000);

setInterval(() => {
    cleanupCaches();
}, CACHE_CLEANUP_INTERVAL);

setInterval(() => {
    forceGarbageCollection();
    console.log(`Memory usage check - Heap used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
}, 604800000);

process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up...');
    for (const timer of cooldownTimers.values()) {
        clearTimeout(timer);
    }
    for (const timer of warningTimers.values()) {
        clearTimeout(timer);
    }
    cooldowns.clear();
    cooldownTimers.clear();
    warningTimers.clear();
    messageCache.clear();
    channelCache.clear();
    console.log('Cleanup completed, exiting...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (message.content === '!help') {
        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('📖 Shop Cooldown Bot')
            .setDescription('ระบบจัดการคูลดาวน์ร้านค้า')
            .addFields(
                { name: '/cooldown', value: 'ตั้งเวลาคูลดาวน์ให้ร้าน', inline: true },
                { name: '/check_cooldown', value: 'ตรวจสอบสถานะทุกร้าน', inline: true },
                { name: '/cancel_cooldown', value: 'ยกเลิกคูลดาวน์ร้าน', inline: true },
                { name: '/sync', value: 'ซิงค์คำสั่ง (แอดมิน)', inline: true },
                { name: '/check_permissions', value: 'ตรวจสอบสิทธิ์บอท', inline: true }
            )
            .setFooter({ text: 'ใช้คำสั่งแบบ Slash เท่านั้น!' });
        message.reply({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);