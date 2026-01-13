const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenStream", function () {
  let tokenStream;
  let mockToken;
  let owner;
  let recipient;
  let addr2;

  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, recipient, addr2] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();

    // Deploy TokenStream
    const TokenStream = await ethers.getContractFactory("TokenStream");
    tokenStream = await TokenStream.deploy();
    await tokenStream.waitForDeployment();

    // Mint tokens to owner
    await mockToken.mint(owner.address, ethers.parseEther("100000"));
    await mockToken.approve(await tokenStream.getAddress(), ethers.parseEther("100000"));
  });

  describe("Deployment", function () {
    it("Should set nextStreamId to 0", async function () {
      expect(await tokenStream.nextStreamId()).to.equal(0);
    });
  });

  describe("createStream", function () {
    it("Should create a stream successfully", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          recipient.address,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.emit(tokenStream, "StreamCreated");

      expect(await tokenStream.nextStreamId()).to.equal(1);
    });

    it("Should transfer tokens to contract", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const contractAddress = await tokenStream.getAddress();

      const balanceBefore = await mockToken.balanceOf(contractAddress);
      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );
      const balanceAfter = await mockToken.balanceOf(contractAddress);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT);
    });

    it("Should store stream data correctly", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_DAY * 7;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        cliffDuration
      );

      const stream = await tokenStream.getStream(0);
      expect(stream.sender).to.equal(owner.address);
      expect(stream.recipient).to.equal(recipient.address);
      expect(stream.token).to.equal(await mockToken.getAddress());
      expect(stream.depositAmount).to.equal(AMOUNT);
      expect(stream.startTime).to.equal(startTime);
      expect(stream.endTime).to.equal(endTime);
      expect(stream.cliffEnd).to.equal(startTime + cliffDuration);
      expect(stream.withdrawn).to.equal(0);
    });

    it("Should track sender and recipient streams", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      const senderStreams = await tokenStream.getSenderStreams(owner.address);
      const recipientStreams = await tokenStream.getRecipientStreams(recipient.address);

      expect(senderStreams.length).to.equal(1);
      expect(recipientStreams.length).to.equal(1);
      expect(senderStreams[0]).to.equal(0);
      expect(recipientStreams[0]).to.equal(0);
    });

    it("Should revert with invalid recipient (zero address)", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should revert when streaming to self", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          owner.address,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Cannot stream to self");
    });

    it("Should revert with invalid token (zero address)", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          recipient.address,
          ethers.ZeroAddress,
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Invalid token");
    });

    it("Should revert with zero amount", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          recipient.address,
          await mockToken.getAddress(),
          0,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert with start time in the past", async function () {
      const startTime = (await time.latest()) - 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStream(
          recipient.address,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Start must be >= now");
    });

    it("Should revert with end time before start time", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime - 1;

      await expect(
        tokenStream.createStream(
          recipient.address,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("End must be > start");
    });

    it("Should revert with cliff exceeding duration", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_MONTH + ONE_DAY;

      await expect(
        tokenStream.createStream(
          recipient.address,
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          cliffDuration
        )
      ).to.be.revertedWith("Cliff exceeds duration");
    });
  });

  describe("createStreamBatch", function () {
    it("Should create multiple streams", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const recipients = [recipient.address, addr2.address];
      const amounts = [AMOUNT, AMOUNT];

      await tokenStream.createStreamBatch(
        recipients,
        await mockToken.getAddress(),
        amounts,
        startTime,
        endTime,
        0
      );

      expect(await tokenStream.nextStreamId()).to.equal(2);
      expect(await tokenStream.getSenderStreamCount(owner.address)).to.equal(2);
    });

    it("Should transfer total amount to contract", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const recipients = [recipient.address, addr2.address];
      const amounts = [AMOUNT, AMOUNT];
      const totalAmount = AMOUNT + AMOUNT;

      const contractAddress = await tokenStream.getAddress();
      const balanceBefore = await mockToken.balanceOf(contractAddress);

      await tokenStream.createStreamBatch(
        recipients,
        await mockToken.getAddress(),
        amounts,
        startTime,
        endTime,
        0
      );

      const balanceAfter = await mockToken.balanceOf(contractAddress);
      expect(balanceAfter - balanceBefore).to.equal(totalAmount);
    });

    it("Should revert with array length mismatch", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const recipients = [recipient.address, addr2.address];
      const amounts = [AMOUNT];

      await expect(
        tokenStream.createStreamBatch(
          recipients,
          await mockToken.getAddress(),
          amounts,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Array length mismatch");
    });

    it("Should revert with empty batch", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenStream.createStreamBatch(
          [],
          await mockToken.getAddress(),
          [],
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Empty batch");
    });

    it("Should revert with batch too large (>100)", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const recipients = Array(101).fill(recipient.address);
      const amounts = Array(101).fill(ethers.parseEther("1"));

      await expect(
        tokenStream.createStreamBatch(
          recipients,
          await mockToken.getAddress(),
          amounts,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Batch too large");
    });
  });

  describe("getWithdrawableAmount", function () {
    it("Should return 0 before stream starts", async function () {
      const startTime = (await time.latest()) + ONE_DAY;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      expect(await tokenStream.getWithdrawableAmount(0)).to.equal(0);
    });

    it("Should return 0 during cliff period", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_DAY * 7;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        cliffDuration
      );

      // Move to after start but before cliff ends
      await time.increase(60 + ONE_DAY);

      expect(await tokenStream.getWithdrawableAmount(0)).to.equal(0);
    });

    it("Should return partial amount during streaming", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      // Move to 50% through the stream
      await time.increase(60 + ONE_MONTH / 2);

      const withdrawable = await tokenStream.getWithdrawableAmount(0);
      // Should be approximately 50% (allowing for timing variance)
      expect(withdrawable).to.be.closeTo(AMOUNT / 2n, ethers.parseEther("1"));
    });

    it("Should return full amount after stream ends", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      // Move past end time
      await time.increase(60 + ONE_MONTH + ONE_DAY);

      expect(await tokenStream.getWithdrawableAmount(0)).to.equal(AMOUNT);
    });

    it("Should return 0 for non-existent stream", async function () {
      expect(await tokenStream.getWithdrawableAmount(999)).to.equal(0);
    });
  });

  describe("withdraw", function () {
    it("Should withdraw available tokens", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      // Move past end time
      await time.increase(60 + ONE_MONTH + ONE_DAY);

      const balanceBefore = await mockToken.balanceOf(recipient.address);
      await tokenStream.connect(recipient).withdraw(0);
      const balanceAfter = await mockToken.balanceOf(recipient.address);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT);
    });

    it("Should emit TokensWithdrawn event", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await time.increase(60 + ONE_MONTH + ONE_DAY);

      await expect(tokenStream.connect(recipient).withdraw(0))
        .to.emit(tokenStream, "TokensWithdrawn")
        .withArgs(0, recipient.address, AMOUNT);
    });

    it("Should update withdrawn amount", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await time.increase(60 + ONE_MONTH + ONE_DAY);
      await tokenStream.connect(recipient).withdraw(0);

      const stream = await tokenStream.getStream(0);
      expect(stream.withdrawn).to.equal(AMOUNT);
    });

    it("Should allow partial withdrawals", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      // First withdrawal at 50%
      await time.increase(60 + ONE_MONTH / 2);
      await tokenStream.connect(recipient).withdraw(0);

      // Second withdrawal at end
      await time.increase(ONE_MONTH / 2 + ONE_DAY);
      await tokenStream.connect(recipient).withdraw(0);

      const stream = await tokenStream.getStream(0);
      expect(stream.withdrawn).to.equal(AMOUNT);
    });

    it("Should revert if not recipient", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await time.increase(60 + ONE_MONTH + ONE_DAY);

      await expect(tokenStream.connect(owner).withdraw(0)).to.be.revertedWith(
        "Not recipient"
      );
    });

    it("Should revert with nothing to withdraw", async function () {
      const startTime = (await time.latest()) + ONE_DAY;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await expect(tokenStream.connect(recipient).withdraw(0)).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });
  });

  describe("withdrawBatch", function () {
    it("Should withdraw from multiple streams", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      // Create two streams to recipient
      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );
      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await time.increase(60 + ONE_MONTH + ONE_DAY);

      const balanceBefore = await mockToken.balanceOf(recipient.address);
      await tokenStream.connect(recipient).withdrawBatch([0, 1]);
      const balanceAfter = await mockToken.balanceOf(recipient.address);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT * 2n);
    });

    it("Should skip streams where caller is not recipient", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );
      await tokenStream.createStream(
        addr2.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await time.increase(60 + ONE_MONTH + ONE_DAY);

      // recipient tries to withdraw from both, but only owns stream 0
      const balanceBefore = await mockToken.balanceOf(recipient.address);
      await tokenStream.connect(recipient).withdrawBatch([0, 1]);
      const balanceAfter = await mockToken.balanceOf(recipient.address);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT);
    });

    it("Should revert with empty batch", async function () {
      await expect(
        tokenStream.connect(recipient).withdrawBatch([])
      ).to.be.revertedWith("Empty batch");
    });

    it("Should revert with batch too large (>50)", async function () {
      const streamIds = Array(51).fill(0);
      await expect(
        tokenStream.connect(recipient).withdrawBatch(streamIds)
      ).to.be.revertedWith("Batch too large");
    });

    it("Should revert if nothing to withdraw from any stream", async function () {
      const startTime = (await time.latest()) + ONE_DAY;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      await expect(
        tokenStream.connect(recipient).withdrawBatch([0])
      ).to.be.revertedWith("Nothing to withdraw");
    });
  });

  describe("View functions", function () {
    it("getSenderStreamCount should return correct count", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );
      await tokenStream.createStream(
        addr2.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      expect(await tokenStream.getSenderStreamCount(owner.address)).to.equal(2);
    });

    it("getRecipientStreamCount should return correct count", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      expect(await tokenStream.getRecipientStreamCount(recipient.address)).to.equal(1);
    });

    it("getStreamRate should return tokens per second", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      const rate = await tokenStream.getStreamRate(0);
      const expectedRate = AMOUNT / BigInt(ONE_MONTH);
      expect(rate).to.equal(expectedRate);
    });

    it("getStreamRate should return 0 for non-existent stream", async function () {
      expect(await tokenStream.getStreamRate(999)).to.equal(0);
    });

    it("getRemainingBalance should return correct amount", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenStream.createStream(
        recipient.address,
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      expect(await tokenStream.getRemainingBalance(0)).to.equal(AMOUNT);

      // Withdraw half
      await time.increase(60 + ONE_MONTH / 2);
      await tokenStream.connect(recipient).withdraw(0);

      const remaining = await tokenStream.getRemainingBalance(0);
      expect(remaining).to.be.closeTo(AMOUNT / 2n, ethers.parseEther("1"));
    });
  });
});
