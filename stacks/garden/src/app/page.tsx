import { Birdhouse, Menu } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.navBox}>
        <div className={styles.iconButton}>
          <Menu size={20} />
        </div>
        <div className={styles.iconButton}>
          <Birdhouse size={18} />
        </div>
      </div>
      <h1 className={styles.hero}>Jaypie Garden</h1>
    </main>
  );
}
