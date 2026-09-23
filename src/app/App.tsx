import { useEffect, useMemo, useState } from 'react';
import styles from './App.module.scss';

type Tab = 'mine' | 'tasks' | 'miners' | 'friends' | 'profile';
type TelegramUser = { id?: number };
type TelegramWindow = Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } } };

const FALLBACK_ID = 5143230997;
const STORAGE_KEY = 'agenb-mining-state';
const BOT_NAME = 'YOUR_BOT';
const levels = Array.from({ length: 12 }, (_, index) => ({ level: index + 1, rate: 5 * (index + 1), price: index === 0 ? 0 : 250 * index }));
const tasks = [
  { icon: '𝕏', title: 'Follow us on X', reward: 50, action: 'Follow' },
  { icon: '▶', title: 'Watch our YouTube', reward: 100, action: 'Watch' },
  { icon: '↗', title: 'Visit AGENB website', reward: 25, action: 'Visit' },
];

function App() {
  const telegramUser = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user;
  const userId = telegramUser?.id ?? FALLBACK_ID;
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [balance, setBalance] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:balance`) ?? 0));
  const [lastClaimTime, setLastClaimTime] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:lastClaim`) ?? Date.now()));
  const [level, setLevel] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:level`) ?? 1));
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const miningRate = levels[level - 1]?.rate ?? 5;
  const unclaimed = Math.max(0, ((now - lastClaimTime) / 1000) * miningRate / 3600);
  const totalBalance = balance + unclaimed;
  const formattedBalance = totalBalance.toFixed(4);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}:balance`, String(balance)); localStorage.setItem(`${STORAGE_KEY}:lastClaim`, String(lastClaimTime)); localStorage.setItem(`${STORAGE_KEY}:level`, String(level)); }, [balance, lastClaimTime, level]);
  useEffect(() => {
    fetch(`/api/mining/${userId}`).then((response) => response.ok ? response.json() : null).then((user) => {
      if (!user) return;
      setBalance(Number(user.balance));
      setLastClaimTime(Number(user.last_claim_time));
      setLevel(Number(user.mining_level));
    }).catch(() => undefined);
  }, [userId]);

  const claim = () => {
    setBalance(totalBalance);
    setLastClaimTime(Date.now());
    setNow(Date.now());
    fetch(`/api/mining/${userId}/claim`, { method: 'POST' }).catch(() => undefined);
  };
  const buyLevel = (nextLevel: number, price: number) => { if (nextLevel === level + 1 && totalBalance >= price) { setBalance(totalBalance - price); setLastClaimTime(Date.now()); setLevel(nextLevel); } };
  const referralLink = `https://t.me/${BOT_NAME}?start=${userId}`;
  const pageTitle = useMemo(() => ({ mine: 'Mining', tasks: 'Earn more', miners: 'Miners', friends: 'Friends', profile: 'Profile' }[activeTab]), [activeTab]);

  const renderContent = () => {
    if (activeTab === 'tasks') return <section className={styles.page}><p className={styles.eyebrow}>REWARDS</p><h1>{pageTitle}</h1><p className={styles.muted}>Complete simple actions and grow your balance.</p><div className={styles.taskList}>{tasks.map((task) => { const done = completedTasks.includes(task.title); return <article className={styles.task} key={task.title}><span className={styles.taskIcon}>{task.icon}</span><div><strong>{task.title}</strong><small>+{task.reward} AGENB</small></div><button className={styles.smallButton} disabled={done} onClick={() => setCompletedTasks([...completedTasks, task.title])}>{done ? 'Done' : task.action}</button></article>; })}</div></section>;
    if (activeTab === 'miners') return <section className={styles.page}><p className={styles.eyebrow}>UPGRADE YOUR RATE</p><h1>Mining levels</h1><p className={styles.muted}>Higher levels mean more AGENB every hour.</p><div className={styles.levelList}>{levels.map((item) => { const unlocked = item.level <= level; const available = item.level === level + 1; return <article className={`${styles.levelCard} ${unlocked ? styles.unlocked : ''}`} key={item.level}><span className={styles.levelNumber}>{String(item.level).padStart(2, '0')}</span><div><strong>Level {item.level}</strong><small>{item.rate} AGENB / hour</small></div><button className={styles.smallButton} disabled={!available} onClick={() => buyLevel(item.level, item.price)}>{unlocked ? 'Active' : available ? `${item.price} AGENB` : 'Locked'}</button></article>; })}</div></section>;
    if (activeTab === 'friends') return <section className={styles.page}><p className={styles.eyebrow}>SHARE THE ENERGY</p><h1>Invite friends</h1><p className={styles.muted}>Bring your crew to AGENB and earn together.</p><div className={styles.referralCard}><span className={styles.referralIcon}>↗</span><strong>Your invite link</strong><div className={styles.linkBox}>{referralLink}</div><button className={styles.goldButton} onClick={() => navigator.clipboard?.writeText(referralLink)}>Copy invite link</button></div><div className={styles.statsRow}><div><strong>0</strong><small>Referrals</small></div><div><strong>0</strong><small>Rewards earned</small></div></div></section>;
    if (activeTab === 'profile') return <section className={styles.page}><p className={styles.eyebrow}>YOUR ACCOUNT</p><h1>Profile</h1><div className={styles.profileId}><span>Telegram ID</span><strong>{userId}</strong></div><div className={styles.walletCard}><div><small>Assets</small><strong>{formattedBalance} <em>AGENB</em></strong></div><div><small>Holding wallet</small><strong>0.0000 <em>AGENB</em></strong></div><div><small>Pool wallet</small><strong>0.0000 <em>AGENB</em></strong></div></div><div className={styles.settings}><button onClick={() => setSoundOn(!soundOn)}><span>Sound effects</span><b>{soundOn ? 'On' : 'Off'}</b></button><button><span>Withdrawal</span><b>Coming soon</b></button></div></section>;
    return <section className={styles.page}><div className={styles.mineHeader}><div><p className={styles.eyebrow}>AGENB MINING</p><h1>Mine daily.<br /><span>Grow steadily.</span></h1></div><div className={styles.live}><i /> LIVE</div></div><div className={styles.coinStage}><div className={styles.coinGlow} /><div className={styles.coin}>A</div></div><div className={styles.earnings}><small>UNCLAIMED EARNINGS</small><strong>+{unclaimed.toFixed(6)} <em>AGENB</em></strong><span>{miningRate} AGENB / hour</span></div><button className={styles.claimButton} onClick={claim}>CLAIM <span>↗</span></button><div className={styles.balanceLine}><span>Total balance</span><strong>{formattedBalance} AGENB</strong></div></section>;
  };

  return (
    <div className={styles.container}>
      <main>{renderContent()}</main>
      <nav className={styles.nav}>{([['mine', '◈', 'Mine'], ['tasks', '✦', 'Tasks'], ['miners', '▣', 'Miners'], ['friends', '↗', 'Friends'], ['profile', '○', 'Profile']] as [Tab, string, string][]).map(([tab, icon, label]) => <button className={activeTab === tab ? styles.navActive : ''} key={tab} onClick={() => setActiveTab(tab)}><span>{icon}</span>{label}</button>)}</nav>
    </div>
  )
}

export default App
