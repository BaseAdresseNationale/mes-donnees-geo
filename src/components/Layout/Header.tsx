import styles from "./Header.module.css";

interface HeaderProps {
  user: {
    fullName: string;
    communeName: string;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className={styles.header} role="banner">
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          🗺️
        </span>
        <span className={styles.title}>Mes données géo</span>
      </div>
      <div className={styles.user}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.fullName}</span>
          <span className={styles.communeName}>{user.communeName}</span>
        </div>
        <form action="/auth/logout" method="post">
          <button type="submit" className={styles.logout}>
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
