import { NavMenu } from "./NavMenu";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <NavMenu />
      <h1 className={styles.hero}>Jaypie Garden</h1>
    </main>
  );
}
